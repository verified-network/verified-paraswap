import _ from 'lodash';
import { AbiItem } from 'web3-utils';
import { NumberAsString, OptimalSwapExchange } from '@paraswap/core';
import { assert, AsyncOrSync } from 'ts-essentials';
import { Interface, JsonFragment } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  TransferFeeParams,
  TxInfo,
  PreprocessTransactionOptions,
  ExchangeTxInfo,
} from '../../types';
import {
  SwapSide,
  Network,
  SRC_TOKEN_PARASWAP_TRANSFERS,
  NULL_ADDRESS,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import {
  getBigIntPow,
  getDexKeysWithNetwork,
  isSrcTokenTransferFeeToBeExchanged,
  uuidToBytes16,
} from '../../utils';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  CurveSwapFunctions,
  CurveV1FactoryData,
  CurveV1FactoryIfaces,
  CurveV1SwapType,
  CustomImplementationNames,
  ImplementationNames,
  PoolConstants,
  DirectCurveV1Param,
} from './types';
import {
  getLocalDeadlineAsFriendlyPlaceholder,
  SimpleExchange,
} from '../simple-exchange';
import { CurveV1FactoryConfig, Adapters } from './config';
import {
  DIRECT_METHOD_NAME,
  FACTORY_MAX_PLAIN_COINS,
  FACTORY_MAX_PLAIN_IMPLEMENTATIONS_FOR_COIN,
  MIN_AMOUNT_TO_RECEIVE,
  POOL_EXCHANGE_GAS_COST,
} from './constants';
import { CurveV1FactoryPoolManager } from './curve-v1-pool-manager';
import CurveABI from '../../abi/Curve.json';
import DirectSwapABI from '../../abi/DirectSwap.json';
import FactoryCurveV1ABI from '../../abi/curve-v1-factory/FactoryCurveV1.json';
import ThreePoolABI from '../../abi/curve-v1-factory/ThreePool.json';
import ERC20ABI from '../../abi/erc20.json';
import {
  addressDecode,
  generalDecoder,
  uint256DecodeToNumber,
  uint8ToNumber,
} from '../../lib/decoders';
import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';
import { BigNumber, BytesLike } from 'ethers';
import { FactoryStateHandler } from './state-polling-pools/factory-pool-polling';
import { PoolPollingBase } from './state-polling-pools/pool-polling-base';
import { CustomBasePoolForFactory } from './state-polling-pools/custom-pool-polling';
import ImplementationConstants from './price-handlers/functions/constants';
import { applyTransferFee } from '../../lib/token-transfer-fee';
import { PriceHandler } from './price-handlers/price-handler';

const DefaultCoinsABI: AbiItem = {
  type: 'function',
  name: 'coins',
  inputs: [
    {
      name: '',
      type: 'uint256',
    },
  ],
  outputs: [
    {
      name: '',
      type: 'address',
    },
  ],
};

export class CurveV1Factory
  extends SimpleExchange
  implements IDex<CurveV1FactoryData, DirectCurveV1Param>
{
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = true;
  readonly isStatePollingDex = true;

  readonly poolManager: CurveV1FactoryPoolManager;
  readonly ifaces: CurveV1FactoryIfaces;

  private areFactoryPoolsFetched: boolean = false;
  private areCustomPoolsFetched: boolean = false;

  readonly SRC_TOKEN_DEX_TRANSFERS = 1;
  readonly DEST_TOKEN_DEX_TRANSFERS = 1;

  readonly directSwapIface = new Interface(DirectSwapABI);

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(CurveV1FactoryConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected config = CurveV1FactoryConfig[dexKey][network],
    // This type is used to support different encoding for uint128 and uint256 args
    private coinsTypeTemplate: AbiItem = DefaultCoinsABI,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(`${this.dexKey}-${this.network}`);
    this.ifaces = {
      exchangeRouter: new Interface(CurveABI),
      factory: new Interface(FactoryCurveV1ABI as JsonFragment[]),
      erc20: new Interface(ERC20ABI as JsonFragment[]),
      threePool: new Interface(ThreePoolABI as JsonFragment[]),
    };

    // I had to put this initialization into CurveV1 because I have to have access to mapping
    // from address to custom pool
    const allPriceHandlers = Object.values(
      this.config.factoryPoolImplementations,
    ).reduce<Record<string, PriceHandler>>((acc, curr) => {
      let baseImplementationName: ImplementationNames | undefined;
      if (curr.basePoolAddress) {
        const customBasePool = this.config.customPools[curr.basePoolAddress];
        if (customBasePool === undefined) {
          this.logger.error(
            `${this.dexKey} on ${this.dexHelper.config.data.network}: can not get customBasePool from basePoolAddress`,
          );
          return acc;
        } else {
          baseImplementationName = customBasePool.name;
        }
      }
      acc[curr.address] = new PriceHandler(
        this.logger,
        curr.name,
        baseImplementationName,
      );
      return acc;
    }, {});

    Object.values(this.config.customPools).reduce((acc, curr) => {
      if (curr.useForPricing) {
        acc[curr.address] = new PriceHandler(this.logger, curr.name);
      }

      return acc;
    }, allPriceHandlers);

    this.poolManager = new CurveV1FactoryPoolManager(
      this.dexKey,
      dexHelper.getLogger(`${this.dexKey}-state-manager`),
      dexHelper,
      allPriceHandlers,
      this.config.stateUpdatePeriodMs,
    );
  }

  async initializePricing(blockNumber: number) {
    // This is only to start timer, each pool is initialized with updated state
    this.poolManager.initializePollingPools();
    await this.fetchFactoryPools(blockNumber);
    await this.poolManager.fetchLiquiditiesFromApi();
    await this.poolManager.updatePollingPoolsInBatch();
    this.logger.info(`${this.dexKey}: successfully initialized`);
  }

  async initializeCustomPollingPools(
    factoryAddresses: string[],
    blockNumber?: number,
    // We don't want to initialize state for PoolTracker. It doesn't make any sense
    initializeInitialState: boolean = true,
  ) {
    if (this.areCustomPoolsFetched) {
      return;
    }

    await Promise.all(
      factoryAddresses.map(async factoryAddress => {
        try {
          await Promise.all(
            Object.values(this.config.customPools).map(async customPool => {
              const poolIdentifier = this.getPoolIdentifier(
                customPool.address,
                false,
              );

              const poolContextConstants =
                ImplementationConstants[customPool.name];
              const {
                N_COINS: nCoins,
                USE_LENDING: useLending,
                isLending,
              } = poolContextConstants;

              const coinsAndImplementations =
                await this.dexHelper.multiWrapper.aggregate(
                  _.range(0, nCoins)
                    .map(i => ({
                      target: customPool.address,
                      callData: this.abiCoder.encodeFunctionCall(
                        this._getCoinsABI(customPool.coinsInputType),
                        [i.toString()],
                      ),
                      decodeFunction: addressDecode,
                    }))
                    .concat([
                      {
                        target: factoryAddress,
                        callData: this.ifaces.factory.encodeFunctionData(
                          'get_implementation_address',
                          [customPool.address],
                        ),
                        decodeFunction: addressDecode,
                      },
                    ]),
                );
              const COINS = coinsAndImplementations.slice(0, -1);
              const implementationAddress =
                coinsAndImplementations.slice(-1)[0];

              const coins_decimals = (
                await this.dexHelper.multiWrapper.tryAggregate(
                  true,
                  COINS.map(c => ({
                    target: c,
                    callData: this.ifaces.erc20.encodeFunctionData(
                      'decimals',
                      [],
                    ),
                    decodeFunction: uint8ToNumber,
                  })),
                )
              ).map(r => r.returnData);

              const poolConstants: PoolConstants = {
                COINS,
                coins_decimals,
                rate_multipliers: this._calcRateMultipliers(coins_decimals),
                lpTokenAddress: customPool.lpTokenAddress,
              };

              let newPool: PoolPollingBase;
              if (
                Object.values<ImplementationNames>(
                  CustomImplementationNames,
                ).includes(customPool.name)
              ) {
                // We don't want custom pools to be used for pricing, unless explicitly specified
                newPool = new CustomBasePoolForFactory(
                  this.logger,
                  this.dexKey,
                  this.dexHelper.config.data.network,
                  this.cacheStateKey,
                  customPool.name,
                  implementationAddress,
                  customPool.address,
                  this.config.stateUpdatePeriodMs,
                  poolIdentifier,
                  poolConstants,
                  poolContextConstants,
                  customPool.liquidityApiSlug,
                  customPool.lpTokenAddress,
                  isLending,
                  customPool.balancesInputType,
                  useLending,
                  customPool.useForPricing,
                );
              } else {
                // Use for pricing pools from factory
                newPool = new CustomBasePoolForFactory(
                  this.logger,
                  this.dexKey,
                  this.dexHelper.config.data.network,
                  this.cacheStateKey,
                  customPool.name,
                  implementationAddress,
                  customPool.address,
                  this.config.stateUpdatePeriodMs,
                  poolIdentifier,
                  poolConstants,
                  poolContextConstants,
                  customPool.liquidityApiSlug,
                  customPool.lpTokenAddress,
                  isLending,
                  customPool.balancesInputType,
                  useLending,
                  true,
                );
              }

              this.poolManager.initializeNewPoolForState(
                poolIdentifier,
                newPool,
              );

              if (initializeInitialState) {
                await this.poolManager.initializeIndividualPollingPoolState(
                  poolIdentifier,
                  CustomBasePoolForFactory.IS_SRC_FEE_ON_TRANSFER_SUPPORTED,
                  blockNumber,
                );
              }
            }),
          );
        } catch (e) {
          this.logger.error(
            `Error initializing custom polling pools for factory ${factoryAddress}: `,
            e,
          );
          throw e;
        }
      }),
    );

    this.areCustomPoolsFetched = true;
  }

  async fetchFactoryPools(
    blockNumber?: number,
    // Variable initializeInitialState is only for poolTracker. We don't want to keep state updated with scheduler
    // We just want to initialize factory pools and send request to CurveAPI
    // Other values are not used
    initializeInitialState: boolean = false,
  ) {
    if (this.areFactoryPoolsFetched) {
      return;
    }

    if (
      !this.config.factoryAddresses ||
      this.config.factoryAddresses.length == 0
    ) {
      this.logger.warn(`No factory address specified in configs`);
      return;
    }

    // There is no scenario when we need to call initialize custom pools without factory pools
    // So I put it here to not forget call, because custom pools must be initialised before factory pools
    // This function may be called multiple times, but will execute only once
    await this.initializeCustomPollingPools(
      this.config.factoryAddresses,
      blockNumber,
      initializeInitialState,
    );

    await Promise.all(
      this.config.factoryAddresses.map(async factoryAddress => {
        try {
          const poolCountResult =
            await this.dexHelper.multiWrapper!.tryAggregate(true, [
              {
                target: factoryAddress,
                callData: this.ifaces.factory.encodeFunctionData('pool_count'),
                decodeFunction: uint256DecodeToNumber,
              },
              // This is used later to request all available implementations. In particular meta implementations
              {
                target: factoryAddress,
                callData:
                  this.ifaces.factory.encodeFunctionData('base_pool_count'),
                decodeFunction: uint256DecodeToNumber,
              },
            ]);

          const poolCount = poolCountResult[0].returnData;
          const basePoolCount = poolCountResult[1].returnData;

          const calldataGetPoolAddresses = _.range(0, poolCount).map(i => ({
            target: factoryAddress,
            callData: this.ifaces.factory.encodeFunctionData('pool_list', [i]),
            decodeFunction: addressDecode,
          }));

          const calldataGetBasePoolAddresses = _.range(0, basePoolCount).map(
            i => ({
              target: factoryAddress,
              callData: this.ifaces.factory.encodeFunctionData(
                'base_pool_list',
                [i],
              ),
              decodeFunction: addressDecode,
            }),
          );

          const allPoolAddresses = (
            await this.dexHelper.multiWrapper.tryAggregate(
              true,
              calldataGetPoolAddresses.concat(calldataGetBasePoolAddresses),
            )
          ).map(e => e.returnData);

          const poolAddresses = allPoolAddresses.slice(0, poolCount);
          const basePoolAddresses = allPoolAddresses.slice(poolCount);

          const customPoolAddresses = Object.values(
            this.config.customPools,
          ).map(customPool => customPool.address);
          basePoolAddresses.forEach(basePool => {
            if (
              !customPoolAddresses.includes(basePool) &&
              !this.config.disabledPools.has(basePool)
            ) {
              this._reportForUnspecifiedCustomPool(basePool);
            }
          });

          let callDataFromFactoryPools: MultiCallParams<
            string[] | number[] | string
          >[] = poolAddresses
            .map(p => [
              {
                target: factoryAddress,
                callData: this.ifaces.factory.encodeFunctionData(
                  'get_implementation_address',
                  [p],
                ),
                decodeFunction: addressDecode,
              },
              {
                target: factoryAddress,
                callData: this.ifaces.factory.encodeFunctionData('get_coins', [
                  p,
                ]),
                decodeFunction: (
                  result: MultiResult<BytesLike> | BytesLike,
                ): string[] =>
                  generalDecoder<string[]>(
                    result,
                    ['address[4]'],
                    new Array(4).fill(NULL_ADDRESS),
                    parsed => parsed[0].map((p: string) => p.toLowerCase()),
                  ),
              },
              {
                target: factoryAddress,
                callData: this.ifaces.factory.encodeFunctionData(
                  'get_decimals',
                  [p],
                ),
                decodeFunction: (
                  result: MultiResult<BytesLike> | BytesLike,
                ): number[] =>
                  generalDecoder<number[]>(
                    result,
                    ['uint256[4]'],
                    [0, 0, 0, 0],
                    parsed =>
                      parsed[0].map((p: BigNumber) => Number(p.toString())),
                  ),
              },
            ])
            .flat();

          // This is divider between pools related results and implementations
          const factoryResultsDivider = callDataFromFactoryPools.length;

          // Implementations must be requested from factory, but it accepts as arg basePool address
          // for metaPools
          callDataFromFactoryPools = callDataFromFactoryPools.concat(
            ...basePoolAddresses.map(basePoolAddress => ({
              target: factoryAddress,
              callData: this.ifaces.factory.encodeFunctionData(
                'metapool_implementations',
                [basePoolAddress],
              ),
              decodeFunction: (
                result: MultiResult<BytesLike> | BytesLike,
              ): string[] =>
                generalDecoder<string[]>(
                  result,
                  ['address[10]'],
                  new Array(10).fill(NULL_ADDRESS),
                  parsed => parsed[0].map((p: string) => p.toLowerCase()),
                ),
            })),
            // To receive plain pool implementation address, you have to call plain_implementations
            // with two variables: N_COINS and implementations_index
            // N_COINS is between 2-4. Currently more than 4 coins is not supported
            // as for implementation index, there are only 0-9 indexes
            ..._.flattenDeep(
              _.range(2, FACTORY_MAX_PLAIN_COINS + 1).map(coinNumber =>
                _.range(FACTORY_MAX_PLAIN_IMPLEMENTATIONS_FOR_COIN).map(
                  implInd => ({
                    target: factoryAddress,
                    callData: this.ifaces.factory.encodeFunctionData(
                      'plain_implementations',
                      [coinNumber, implInd],
                    ),
                    decodeFunction: addressDecode,
                  }),
                ),
              ),
            ),
          );

          const allResultsFromFactory = (
            await this.dexHelper.multiWrapper.tryAggregate<
              string[] | number[] | string
            >(true, callDataFromFactoryPools)
          ).map(r => r.returnData);

          const resultsFromFactory = allResultsFromFactory.slice(
            0,
            factoryResultsDivider,
          );

          const allAvailableImplementations = _.flattenDeep(
            allResultsFromFactory.slice(factoryResultsDivider) as string[],
          ).filter(
            implementation =>
              implementation !== NULL_ADDRESS &&
              !this.config.disabledImplementations.has(implementation),
          );

          allAvailableImplementations.forEach(implementation => {
            const currentImplementation =
              this.config.factoryPoolImplementations[implementation];
            if (currentImplementation === undefined) {
              this._reportForUnspecifiedImplementation(implementation);
            }
          });

          const stateInitializePromises: Promise<void>[] = [];
          _.chunk(resultsFromFactory, 3).forEach((result, i) => {
            if (this.config.disabledPools.has(poolAddresses[i])) {
              this.logger.trace(`Filtering disabled pool ${poolAddresses[i]}`);
              return;
            }

            let [implementationAddress, coins, coins_decimals] = result as [
              string,
              string[],
              number[],
            ];

            implementationAddress = implementationAddress.toLowerCase();
            coins = coins
              .map(c => c.toLowerCase())
              .filter(c => c !== NULL_ADDRESS);
            coins_decimals = coins_decimals.filter(cd => cd !== 0);

            const factoryImplementationFromConfig =
              this.config.factoryPoolImplementations[implementationAddress];

            if (
              factoryImplementationFromConfig === undefined &&
              !this.config.disabledImplementations.has(implementationAddress)
            ) {
              this._reportForUnspecifiedImplementation(
                implementationAddress,
                poolAddresses[i],
              );
              return;
            }

            const factoryImplementationConstants =
              ImplementationConstants[factoryImplementationFromConfig.name];

            let isMeta: boolean = false;
            let basePoolStateFetcher: PoolPollingBase | undefined;
            if (factoryImplementationFromConfig.basePoolAddress !== undefined) {
              isMeta = true;
              const basePoolIdentifier = this.getPoolIdentifier(
                factoryImplementationFromConfig.basePoolAddress,
                false,
              );
              const basePool = this.poolManager.getPool(
                basePoolIdentifier,
                false,
              );
              if (basePool === null) {
                this.logger.error(
                  `${this.dexKey}_${this.dexHelper.config.data.network}: custom base pool ${basePoolIdentifier} was not initialized properly. ` +
                    `You must call initializeCustomPollingPools before fetching factory`,
                );
                return;
              }
              basePoolStateFetcher = basePool;
            }

            const poolConstants: PoolConstants = {
              COINS: coins,
              coins_decimals,
              rate_multipliers: this._calcRateMultipliers(coins_decimals),
            };

            const poolIdentifier = this.getPoolIdentifier(
              poolAddresses[i],
              isMeta,
            );

            const newPool = new FactoryStateHandler(
              this.logger,
              this.dexKey,
              this.dexHelper.config.data.network,
              this.cacheStateKey,
              factoryImplementationFromConfig.name,
              implementationAddress.toLowerCase(),
              poolAddresses[i],
              this.config.stateUpdatePeriodMs,
              factoryAddress,
              poolIdentifier,
              poolConstants,
              factoryImplementationConstants,
              factoryImplementationConstants.isFeeOnTransferSupported,
              factoryImplementationFromConfig.liquidityApiSlug ?? '/factory',
              basePoolStateFetcher,
              factoryImplementationFromConfig.customGasCost,
              factoryImplementationFromConfig.isStoreRateSupported,
            );

            this.poolManager.initializeNewPool(poolIdentifier, newPool);

            if (initializeInitialState) {
              stateInitializePromises.push(
                this.poolManager.initializeIndividualPollingPoolState(
                  poolIdentifier,
                  factoryImplementationConstants.isFeeOnTransferSupported,
                ),
              );
            }
          });

          await Promise.all(stateInitializePromises);
        } catch (e) {
          this.logger.error(
            `Error fetching factory pools for ${factoryAddress}: `,
            e,
          );
          throw e;
        }
      }),
    );

    this.areFactoryPoolsFetched = true;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPoolIdentifier(poolAddress: string, isMeta: boolean): string {
    return `${this.dexKey}_${poolAddress}_${isMeta}`;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (side === SwapSide.BUY) {
      return [];
    }

    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();

    if (srcTokenAddress === destTokenAddress) {
      return [];
    }

    const pools = this.poolManager.getPoolsForPair(
      srcTokenAddress,
      destTokenAddress,
    );

    return pools.map(pool =>
      this.getPoolIdentifier(pool.address, pool.isMetaPool),
    );
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
    transferFees: TransferFeeParams = {
      srcFee: 0,
      destFee: 0,
      srcDexFee: 0,
      destDexFee: 0,
    },
  ): Promise<null | ExchangePrices<CurveV1FactoryData>> {
    try {
      if (side === SwapSide.BUY) {
        return null;
      }

      const _isSrcTokenTransferFeeToBeExchanged =
        isSrcTokenTransferFeeToBeExchanged(transferFees);

      const srcTokenAddress = srcToken.address.toLowerCase();
      const destTokenAddress = destToken.address.toLowerCase();

      if (srcTokenAddress === destTokenAddress) {
        return null;
      }

      let pools: PoolPollingBase[] = [];
      if (limitPools !== undefined) {
        pools = limitPools
          .map(poolIdentifier =>
            this.poolManager.getPool(
              poolIdentifier,
              _isSrcTokenTransferFeeToBeExchanged,
            ),
          )
          .filter(
            (pool): pool is PoolPollingBase =>
              pool !== null &&
              pool.getPoolData(srcTokenAddress, destTokenAddress) !== null,
          );
      } else {
        pools = this.poolManager.getPoolsForPair(
          srcTokenAddress,
          destTokenAddress,
          _isSrcTokenTransferFeeToBeExchanged,
        );
      }

      if (pools.length <= 0) {
        return null;
      }

      if (pools.length > 10) {
        // I expect this to not happen
        this.logger.warn(
          `${this.dexKey}: There are more than 10 pools found for pair: ${srcTokenAddress}-${destTokenAddress}`,
        );
      }

      const amountsWithUnit = [
        getBigIntPow(srcToken.decimals),
        ...amounts.slice(1),
      ];
      const amountsWithUnitAndFee = _isSrcTokenTransferFeeToBeExchanged
        ? applyTransferFee(
            applyTransferFee(
              amountsWithUnit,
              side,
              transferFees.srcFee,
              SRC_TOKEN_PARASWAP_TRANSFERS,
            ),
            side,
            transferFees.srcDexFee,
            this.SRC_TOKEN_DEX_TRANSFERS,
          )
        : amountsWithUnit;

      const results = await Promise.all(
        pools.map(
          async (pool): Promise<PoolPrices<CurveV1FactoryData> | null> => {
            let state = pool.getState();
            if (!state) {
              await this.poolManager.updateManuallyPollingPools(
                pool.baseStatePoolPolling
                  ? [pool.baseStatePoolPolling, pool]
                  : [pool],
              );
              state = pool.getState();
              if (!state) {
                return null;
              }
            }

            if (state.balances.every(b => b === 0n)) {
              this.logger.trace(
                `${this.dexKey} on ${this.dexHelper.config.data.network}: State balances equal to 0 in pool ${pool.address}`,
              );
              return null;
            }

            const poolData = pool.getPoolData(
              srcTokenAddress,
              destTokenAddress,
            );

            if (poolData === null) {
              this.logger.error(
                `${pool.fullName}: one or both tokens can not be exchanged in pool ${pool.address}: ${srcTokenAddress} -> ${destTokenAddress}`,
              );
              return null;
            }

            let outputs: bigint[] = this.poolManager
              .getPriceHandler(pool.implementationAddress)
              .getOutputs(
                state,
                amountsWithUnitAndFee,
                poolData.i,
                poolData.j,
                poolData.underlyingSwap,
              );

            outputs = applyTransferFee(
              outputs,
              side,
              transferFees.destDexFee,
              this.DEST_TOKEN_DEX_TRANSFERS,
            );

            return {
              prices: [0n, ...outputs.slice(1)],
              unit: outputs[0],
              data: poolData,
              exchange: this.dexKey,
              poolIdentifier: pool.poolIdentifier,
              gasCost: POOL_EXCHANGE_GAS_COST,
              poolAddresses: [pool.address],
            };
          },
        ),
      );

      return results.filter(
        (
          r: PoolPrices<CurveV1FactoryData> | null,
        ): r is PoolPrices<CurveV1FactoryData> => r !== null,
      );
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `Error_${this.dexKey}_${this.dexHelper.config.data.network}_getPrices: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(
        `Error_${this.dexKey}_${this.dexHelper.config.data.network}_getPrices`,
        e,
      );
      return null;
    }
  }

  getCalldataGasCost(
    poolPrices: PoolPrices<CurveV1FactoryData>,
  ): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_SMALL +
      CALLDATA_GAS_COST.INDEX +
      CALLDATA_GAS_COST.INDEX +
      CALLDATA_GAS_COST.TIMESTAMP +
      CALLDATA_GAS_COST.BOOL
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveV1FactoryData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { i, j, underlyingSwap } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          i: 'int128',
          j: 'int128',
          deadline: 'uint256',
          underlyingSwap: 'bool',
        },
      },
      { i, j, deadline: 0, underlyingSwap },
    );

    return {
      targetExchange: data.exchange,
      payload,
      networkFee: '0',
    };
  }

  getTokenFromAddress(address: Address): Token {
    // In this Dex decimals are not used
    return { address, decimals: 0 };
  }

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<CurveV1FactoryData>,
    srcToken: Token,
    _0: Token,
    _1: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<CurveV1FactoryData>, ExchangeTxInfo]> {
    if (!options.isDirectMethod) {
      return [
        optimalSwapExchange,
        {
          deadline: BigInt(getLocalDeadlineAsFriendlyPlaceholder()),
        },
      ];
    }

    assert(
      optimalSwapExchange.data !== undefined,
      `preProcessTransaction: data field is missing`,
    );

    let isApproved: boolean | undefined;

    try {
      this.erc20Contract.options.address =
        this.dexHelper.config.wrapETH(srcToken).address;
      const allowance = await this.erc20Contract.methods
        .allowance(this.augustusAddress, optimalSwapExchange.data.exchange)
        .call(undefined, 'latest');
      isApproved =
        BigInt(allowance.toString()) >= BigInt(optimalSwapExchange.srcAmount);
    } catch (e) {
      this.logger.error(
        `preProcessTransaction failed to retrieve allowance info: `,
        e,
      );
    }

    return [
      {
        ...optimalSwapExchange,
        data: {
          ...optimalSwapExchange.data,
          isApproved,
        },
      },
      {
        deadline: BigInt(getLocalDeadlineAsFriendlyPlaceholder()),
      },
    ];
  }

  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    expectedAmount: NumberAsString,
    data: CurveV1FactoryData,
    side: SwapSide,
    permit: string,
    uuid: string,
    feePercent: NumberAsString,
    deadline: NumberAsString,
    partner: string,
    beneficiary: string,
    contractMethod?: string,
  ): TxInfo<DirectCurveV1Param> {
    if (contractMethod !== DIRECT_METHOD_NAME) {
      throw new Error(`Invalid contract method ${contractMethod}`);
    }
    assert(side === SwapSide.SELL, 'Buy not supported');

    let isApproved: boolean = !!data.isApproved;
    if (data.isApproved === undefined) {
      this.logger.warn(`isApproved is undefined, defaulting to false`);
    }

    const swapParams: DirectCurveV1Param = [
      srcToken,
      destToken,
      data.exchange,
      srcAmount,
      destAmount,
      expectedAmount,
      feePercent,
      data.i.toString(),
      data.j.toString(),
      partner,
      isApproved,
      data.underlyingSwap
        ? CurveV1SwapType.EXCHANGE_UNDERLYING
        : CurveV1SwapType.EXCHANGE,
      beneficiary,
      // For CurveV1 we work as it is, without wrapping and unwrapping
      false,
      permit,
      uuidToBytes16(uuid),
    ];

    const encoder = (...params: DirectCurveV1Param) => {
      return this.directSwapIface.encodeFunctionData(DIRECT_METHOD_NAME, [
        params,
      ]);
    };

    return {
      params: swapParams,
      encoder,
      networkFee: '0',
    };
  }

  static getDirectFunctionName(): string[] {
    return [DIRECT_METHOD_NAME];
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveV1FactoryData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { exchange, i, j, underlyingSwap } = data;
    const defaultArgs = [i, j, srcAmount, MIN_AMOUNT_TO_RECEIVE];
    const swapMethod = underlyingSwap
      ? CurveSwapFunctions.exchange_underlying
      : CurveSwapFunctions.exchange;

    const swapData = this.ifaces.exchangeRouter.encodeFunctionData(
      swapMethod,
      defaultArgs,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }

  async updatePoolState(): Promise<void> {
    if (!this.areFactoryPoolsFetched) {
      await this.fetchFactoryPools(undefined, false);
    }

    await this.poolManager.fetchLiquiditiesFromApi();
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.areFactoryPoolsFetched) {
      this.logger.error(
        `${this.dexKey}: received getTopPools while factory pools are not fetched`,
      );
      return [];
    }
    const _tokenAddress = tokenAddress.toLowerCase();
    const poolsWithToken = this.poolManager.getPoolsWithToken(_tokenAddress);

    if (poolsWithToken.length === 0) {
      return [];
    }

    return poolsWithToken
      .reduce<PoolLiquidity[]>((acc, pool) => {
        let inCoins = false;
        let inUnderlying = false;
        const inCoinConnectors: Token[] = [];
        for (const [i, coin] of pool.poolConstants.COINS.entries()) {
          if (coin === _tokenAddress) {
            inCoins = true;
          } else {
            inCoinConnectors.push({
              address: coin,
              decimals: pool.poolConstants.coins_decimals[i],
            });
          }
        }

        const underlyingConnectors: Token[] = [];
        for (const [underlying, i] of Object.entries(
          pool.underlyingCoinsToIndices,
        )) {
          if (underlying === _tokenAddress) {
            inUnderlying = true;
          } else {
            underlyingConnectors.push({
              address: underlying,
              decimals: pool.underlyingDecimals[i],
            });
          }
        }
        let connectorTokens: Token[] = [];
        if (inCoins) {
          connectorTokens = connectorTokens.concat(inCoinConnectors);
        }
        if (inUnderlying) {
          connectorTokens = connectorTokens.concat(underlyingConnectors);
        }
        if (connectorTokens.length) {
          acc.push({
            exchange: this.dexKey,
            address: pool.address,
            liquidityUSD: pool.liquidityUSD,
            connectorTokens: _.uniqBy(connectorTokens, 'address'),
          });
        }
        return acc;
      }, [])
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, limit);
  }

  releaseResources(): AsyncOrSync<void> {
    this.poolManager.releaseResources();
  }

  private _calcRateMultipliers(coins_decimals: number[]): bigint[] {
    return coins_decimals.map(coinDecimal => getBigIntPow(36 - coinDecimal));
  }

  private _reportForUnspecifiedImplementation(
    implementation: Address,
    pool?: Address,
  ) {
    this.logger.warn(
      `${this.dexKey}: on network ${this.dexHelper.config.data.network} ` +
        `found unspecified implementation: ${implementation} for ${pool} pool. Skipping pool`,
    );
  }

  private _reportForUnspecifiedCustomPool(pool: Address) {
    this.logger.error(
      `${this.dexKey}: on network ${this.dexHelper.config.data.network} ` +
        `found unspecified custom pool: ${pool}`,
    );
  }

  private _getCoinsABI(type: string): AbiItem {
    const newCoinsType = _.cloneDeep(this.coinsTypeTemplate);
    newCoinsType.inputs![0].type = type;
    return newCoinsType;
  }
}

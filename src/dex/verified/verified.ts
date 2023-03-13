import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import _, { keyBy } from 'lodash';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  Log,
} from '../../types';
import {
  PoolState,
  PoolStateMap,
  BalancerPoolTypes,
  SubgraphPoolBase,
} from './types';
import { SwapSide, Network, SUBGRAPH_TIMEOUT } from '../../constants';
import {
  getAllPoolsUsedInPaths,
  isSameAddress,
  poolGetMainTokens,
  poolGetPathForTokenInOut,
} from './utils';
import {
  MIN_USD_LIQUIDITY_TO_FETCH,
  STABLE_GAS_COST,
  VARIABLE_GAS_COST_PER_CYCLE,
} from './constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { VerifiedData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { VerifiedConfig, Adapters } from './config';
import { Interface } from '@ethersproject/abi';
import VaultABI from '../../abi/balancer-v2/vault.json';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { PrimaryIssuePool, SecondaryIssuePool } from './verified-pool';

const MAX_POOL_CNT = 1000; // Taken from SOR
const POOL_CACHE_TTL = 60 * 60; // 1 hr
const POOL_EVENT_DISABLED_TTL = 5 * 60; // 5 min
const POOL_EVENT_REENABLE_DELAY = 7 * 24 * 60 * 60; // 1 week

const fetchAllPools = `query ($count: Int) {
  pools: pools(
    first: $count
    orderBy: totalLiquidity
    orderDirection: desc
    where: {totalLiquidity_gt: ${MIN_USD_LIQUIDITY_TO_FETCH.toString()}, totalShares_not_in: ["0", "0.000000000001"], id_not_in: ["0xbd482ffb3e6e50dc1c437557c3bea2b68f3683ee0000000000000000000003c6"], swapEnabled: true, poolType_in: ["MetaStable", "Stable", "Weighted", "LiquidityBootstrapping", "Investment", "StablePhantom", "AaveLinear", "ERC4626Linear", "Linear", "ComposableStable"]}
  ) {
    id
    address
    poolType
    tokens {
      address
      decimals
    }
    mainIndex
    wrappedIndex
  }
}`;

function typecastReadOnlyPoolState(pool: DeepReadonly<PoolState>): PoolState {
  return _.cloneDeep(pool) as PoolState;
}

export class VerifiedEventPool extends StatefulEventSubscriber<PoolStateMap> {
  public vaultInterface: Interface;

  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  pools: {
    [type: string]: PrimaryIssuePool | SecondaryIssuePool;
  };

  public allPools: SubgraphPoolBase[] = [];

  vaultDecoder: (log: Log) => any;

  eventSupportedPoolTypes: BalancerPoolTypes[] = [
    BalancerPoolTypes.PrimaryIssuePool,
    BalancerPoolTypes.SecondaryIssuePool,
  ];

  eventRemovedPools = ([] as Address[]).map(s => s.toLowerCase());

  constructor(
    parentName: string,
    protected network: number,
    protected vaultAddress: Address,
    protected subgraphURL: string,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(parentName, vaultAddress, dexHelper, logger);

    this.vaultInterface = new Interface(VaultABI);

    const PrimaryPool = new PrimaryIssuePool(
      this.vaultAddress,
      this.vaultInterface,
    );
    const SecondaryPool = new SecondaryIssuePool(
      this.vaultAddress,
      this.vaultInterface,
    );

    this.pools = {};
    //this.pools[BalancerPoolTypes.PrimaryIssuePool] = ;
    //this.pools[BalancerPoolTypes.SecondaryIssuePool] = ;
    this.vaultDecoder = (log: Log) => this.vaultInterface.parseLog(log);
    this.addressesSubscribed = [vaultAddress];

    // Add default handlers
    this.handlers['Swap'] = this.handleSwap.bind(this);
    this.handlers['PoolBalanceChanged'] =
      this.handlePoolBalanceChanged.bind(this);
  }

  protected processLog(
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const _state: PoolStateMap = {};
    for (const [address, pool] of Object.entries(state))
      _state[address] = typecastReadOnlyPoolState(pool);

    try {
      const event = this.vaultDecoder(log);
      if (event.name in this.handlers) {
        const poolAddress = event.args.poolId.slice(0, 42).toLowerCase();
        // Only update the _state if we are tracking the pool
        if (poolAddress in _state) {
          _state[poolAddress] = this.handlers[event.name](
            event,
            _state[poolAddress],
            log,
          );
        }
      }
      return _state;
    } catch (e) {
      this.logger.error(
        `Error_${this.parentName}_processLog could not parse the log with topic ${log.topics}:`,
        e,
      );
      return null;
    }
  }

  async fetchAllSubgraphPools(): Promise<SubgraphPoolBase[]> {
    const cacheKey = 'BalancerVerifiedSubgraphPools';
    const cachedPools = await this.dexHelper.cache.get(
      this.parentName,
      this.network,
      cacheKey,
    );
    if (cachedPools) {
      const allPools = JSON.parse(cachedPools);
      this.logger.info(
        `Got ${allPools.length} ${this.parentName}_${this.network} pools from cache`,
      );
      return allPools;
    }

    this.logger.info(
      `Fetching ${this.parentName}_${this.network} Pools from subgraph`,
    );
    const variables = {
      count: MAX_POOL_CNT,
    };
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      { query: fetchAllPools, variables },
      SUBGRAPH_TIMEOUT,
    );

    if (!(data && data.pools))
      throw new Error('Unable to fetch pools from the subgraph');

    const poolsMap = keyBy(data.pools, 'address');
    const allPools: SubgraphPoolBase[] = data.pools.map(
      (pool: Omit<SubgraphPoolBase, 'mainTokens'>) => ({
        ...pool,
        mainTokens: poolGetMainTokens(pool, poolsMap),
      }),
    );

    this.dexHelper.cache.setex(
      this.parentName,
      this.network,
      cacheKey,
      POOL_CACHE_TTL,
      JSON.stringify(allPools),
    );

    this.logger.info(
      `Got ${allPools.length} ${this.parentName}_${this.network} pools from subgraph`,
    );
    return allPools;
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolStateMap>> {
    const allPools = await this.fetchAllSubgraphPools();
    this.allPools = allPools;
    const eventSupportedPools = allPools.filter(
      pool =>
        this.eventSupportedPoolTypes.includes(pool.poolType) &&
        !this.eventRemovedPools.includes(pool.address.toLowerCase()),
    );
    const allPoolsLatestState = await this.getOnChainState(
      eventSupportedPools,
      blockNumber,
    );
    return allPoolsLatestState;
  }

  async getOnChainState(
    subgraphPoolBase: SubgraphPoolBase[],
    blockNumber: number,
  ): Promise<PoolStateMap> {
    const multiCallData = subgraphPoolBase
      .map(pool => {
        if (!this.isSupportedPool(pool.poolType)) return [];

        return this.pools[pool.poolType].getOnChainCalls(pool);
      })
      .flat();

    // 500 is an arbitrary number chosen based on the blockGasLimit
    const slicedMultiCallData = _.chunk(multiCallData, 500);

    const returnData = (
      await Promise.all(
        slicedMultiCallData.map(async _multiCallData =>
          this.dexHelper.multiContract.methods
            .tryAggregate(false, _multiCallData)
            .call({}, blockNumber),
        ),
      )
    ).flat();

    let i = 0;
    const onChainStateMap = subgraphPoolBase.reduce(
      (acc: { [address: string]: PoolState }, pool) => {
        if (!this.isSupportedPool(pool.poolType)) return acc;

        const [decoded, newIndex] = this.pools[
          pool.poolType
        ].decodeOnChainCalls(pool, returnData, i);
        i = newIndex;
        acc = { ...acc, ...decoded };
        return acc;
      },
      {},
    );

    return onChainStateMap;
  }

  handleSwap(event: any, pool: PoolState, log: Log): PoolState {
    const tokenIn = event.args.tokenIn.toLowerCase();
    const amountIn = BigInt(event.args.amountIn.toString());
    const tokenOut = event.args.tokenOut.toLowerCase();
    const amountOut = BigInt(event.args.amountOut.toString());
    pool.tokens[tokenIn].balance += amountIn;
    pool.tokens[tokenOut].balance -= amountOut;
    return pool;
  }

  handlePoolBalanceChanged(event: any, pool: PoolState, log: Log): PoolState {
    const tokens = event.args.tokens.map((t: string) => t.toLowerCase());
    const deltas = event.args.deltas.map((d: any) => BigInt(d.toString()));
    const fees = event.args.protocolFeeAmounts.map((d: any) =>
      BigInt(d.toString()),
    ) as bigint[];
    tokens.forEach((t: string, i: number) => {
      const diff = deltas[i] - fees[i];
      pool.tokens[t].balance += diff;
    });
    return pool;
  }

  isSupportedPool(poolType: string): boolean {
    const supportedPoolTypes: string[] = Object.values(BalancerPoolTypes);
    return supportedPoolTypes.includes(poolType);
  }
}

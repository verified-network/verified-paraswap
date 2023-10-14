/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Verified } from './verified';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { VerifiedData, VerifiedParam } from './types';
import { SmartTokenParams } from '../../../tests/smart-tokens';
import { PoolPrices } from '../../types';

/*
  README
  ======

  This test script adds tests for Verified general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover Verified specific
  logic.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-integration.test.ts`

  (This comment should be removed from the final implementation)
*/

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  funcName: string,
  params: VerifiedParam,
) {
  return [
    {
      target: exchangeAddress,
      callData: readerIface.encodeFunctionData(funcName, params.slice(0, 4)),
    },
  ];
}

function decodeReaderResult(
  result: any,
  readerIface: Interface,
  funcName: string,
  side: SwapSide,
) {
  const parsed = readerIface.decodeFunctionResult(
    funcName,
    result.returnData[0],
  );
  const resultIndex = side === SwapSide.SELL ? parsed[0].length - 1 : 0;
  return BigInt(parsed[0][resultIndex]._hex.replace('-', ''));
}

async function checkOnChainPricing(
  verified: Verified,
  srcToken: string,
  destToken: string,
  funcName: string,
  blockNumber: number,
  amounts: bigint,
  poolPrices: PoolPrices<VerifiedData>,
  side: SwapSide,
) {
  const exchangeAddress = verified.eventPools.vaultAddress;
  const readerIface = verified.eventPools.vaultInterface;
  const data = {
    swaps: [
      {
        poolId: poolPrices.data.poolId,
        amount: amounts.toString(),
      },
    ],
  };

  const params = verified.getVerifiedParam(
    srcToken,
    destToken,
    '0',
    '0',
    data,
    side,
  );
  // console.log("verified params: ", params)
  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    funcName,
    params,
  );
  try {
    const readerResult = await verified.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber);
    return decodeReaderResult(readerResult, readerIface, funcName, side);
  } catch (err) {
    //to handle reverts from contract when certain amounts can't be swapped
    return 0n;
  }
}
async function testPricingOnNetwork(
  verified: Verified,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
  funcNameToCheck: string,
) {
  const networkTokens = Tokens[network];

  const pools = await verified.getPoolIdentifiers(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    side,
    blockNumber,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Identifiers: `,
    pools,
  );

  expect(pools.length).toBeGreaterThan(0);

  const poolPrices = await verified.getPricesVolume(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    amounts,
    side,
    blockNumber,
    pools,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Prices When ${side}ING amounts: [${amounts}] are:`,
    poolPrices,
  );

  expect(poolPrices).not.toBeNull();

  let noZeroPrice = true;
  poolPrices![0].prices.map((price, idx) => {
    if (idx !== 0 && price === 0n) {
      noZeroPrice = false;
    }
  });
  if (verified.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    noZeroPrice
      ? checkPoolPrices(poolPrices!, amounts, side, dexKey)
      : checkPoolPrices(poolPrices!, amounts, side, dexKey, false);
  }

  //Check if onchain pricing equals to calculated ones
  poolPrices![0].prices.map(async (price, idx) => {
    if (amounts[idx] !== 0n) {
      const onChainPrice = await checkOnChainPricing(
        verified,
        networkTokens[srcTokenSymbol].address,
        networkTokens[destTokenSymbol].address,
        funcNameToCheck,
        blockNumber,
        amounts[idx],
        poolPrices![0],
        side,
      );
      expect(onChainPrice).toEqual(price);
    }
  });
}

describe('Verified Integration Tests', function () {
  const dexKey = 'Verified';
  let verified: Verified;
  let blockNumber: number;
  const network = Network.POLYGON;
  const dexHelper = new DummyDexHelper(network);
  const tokens = Tokens[network];
  const srcTokenSymbol = 'USDC';
  const destTokenSymbol = 'CH1265330';

  //stop at 2 USDC(2000000) because current USDC balance is 2.25016(2250160) from the pool
  //anything above the balance when selling will give 0 price
  const usdcAmounts = [
    0n,
    1n * BI_POWS[tokens[srcTokenSymbol].decimals],
    2n * BI_POWS[tokens[srcTokenSymbol].decimals],
  ];

  //stop at 3 CH1265330(3000000000000000000 CH1265330) to avoid 0 price because when you attempt to sell 4 CH1265330
  //the return will be more than 2.25016 USDC which is above the current USDC balance from pool.
  const ch1265330Amounts = [
    0n,
    1n * BI_POWS[tokens[destTokenSymbol].decimals],
    2n * BI_POWS[tokens[destTokenSymbol].decimals],
    3n * BI_POWS[tokens[destTokenSymbol].decimals],
  ];

  beforeAll(async () => {
    blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    verified = new Verified(network, dexKey, dexHelper);
    if (verified.initializePricing) {
      await verified.initializePricing(blockNumber);
    }
  });

  it('getPoolIdentifiers and getPricesVolume **SELL** for USDC in CH1265330 out', async function () {
    const a = await testPricingOnNetwork(
      verified,
      network,
      dexKey,
      blockNumber,
      srcTokenSymbol,
      destTokenSymbol,
      SwapSide.SELL,
      usdcAmounts, //amount will be amount in/srcToken amount since we are selling
      'queryBatchSwap',
    );
  });

  it('getPoolIdentifiers and getPricesVolume **SELL** for CH1265330 in USDC out', async function () {
    const a = await testPricingOnNetwork(
      verified,
      network,
      dexKey,
      blockNumber,
      destTokenSymbol, //CH1265330 is now srcToken
      srcTokenSymbol,
      SwapSide.SELL,
      ch1265330Amounts, //amount will be amount in/srcToken amount since we are selling
      'queryBatchSwap',
    );
  });

  it('getPoolIdentifiers and getPricesVolume **BUY** for USDC in CH1265330 out', async function () {
    await testPricingOnNetwork(
      verified,
      network,
      dexKey,
      blockNumber,
      srcTokenSymbol,
      destTokenSymbol,
      SwapSide.BUY,
      ch1265330Amounts, //amount will be amount out/destToken amount since we are buying
      'queryBatchSwap',
    );
  });

  //will return 0 prices due to minimumOrderSize of the pool
  it('getPoolIdentifiers and getPricesVolume **BUY** for CH1265330 in USDC out', async function () {
    await testPricingOnNetwork(
      verified,
      network,
      dexKey,
      blockNumber,
      destTokenSymbol, //CH1265330 is now srcToken
      srcTokenSymbol,
      SwapSide.BUY,
      usdcAmounts, //amount will be amount out/destToken amount since we are buying
      'queryBatchSwap',
    );
  });

  it('getTopPoolsForToken', async function () {
    const networkTokens = Tokens[network];
    const usdcPoolLiquidity = await verified.getTopPoolsForToken(
      networkTokens[srcTokenSymbol].address,
      10,
    );
    const ch1265330PoolLiquidity = await verified.getTopPoolsForToken(
      networkTokens[destTokenSymbol].address,
      10,
    );
    console.log(srcTokenSymbol, ' Top Pools:', usdcPoolLiquidity);
    console.log(destTokenSymbol, ' Top Pools:', ch1265330PoolLiquidity);

    expect(
      usdcPoolLiquidity.map(pool =>
        ch1265330PoolLiquidity.find(
          _pool => pool.address.toLowerCase() === _pool.address.toLowerCase(),
        ),
      ),
    ).not.toEqual(undefined || null);

    //don't check liquidity for now polygon pools do not have liquidity yet
    // if (!verified.hasConstantPriceLargeAmounts) {
    //   checkPoolsLiquidity(
    //     usdcPoolLiquidity,
    //     networkTokens[srcTokenSymbol].address,
    //     dexKey,
    //   );
    //   checkPoolsLiquidity(
    //     ch1265330PoolLiquidity,
    //     networkTokens[destTokenSymbol].address,
    //     dexKey,
    //   );
    // }
  });
});

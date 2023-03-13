import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { MathSol } from './balancer-v2-math';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { callData, SubgraphPoolBase, PoolState, TokenState } from './types';
import { getTokenScalingFactor, decodeThrowError } from './utils';
import PrimaryPoolABI from '../../abi/verified/PrimaryIssuePool.json';
import SecondaryPoolABI from '../../abi/verified/SecondaryIssuePool.json';

export class BasePool {
  _subtractSwapFeeAmount(amount: bigint, _swapFeePercentage: bigint): bigint {
    // This returns amount - fee amount, so we round up (favoring a higher fee amount).
    const feeAmount = MathSol.mulUpFixed(amount, _swapFeePercentage);
    return amount - feeAmount;
  }

  // These methods use fixed versions to match SC scaling
  _upscaleArray(amounts: bigint[], scalingFactors: bigint[]): bigint[] {
    return amounts.map((a, i) => MathSol.mulUpFixed(a, scalingFactors[i]));
  }

  _upscale(amount: bigint, scalingFactor: bigint): bigint {
    return MathSol.mulUpFixed(amount, scalingFactor);
  }

  _downscaleDown(amount: bigint, scalingFactor: bigint): bigint {
    return MathSol.divDownFixed(amount, scalingFactor);
  }

  _nullifyIfMaxAmountExceeded(amountToTrade: bigint, swapMax: bigint): bigint {
    return swapMax >= amountToTrade ? amountToTrade : 0n;
  }
}

type WeightedPoolPairData = {
  tokenInBalance: bigint;
  tokenOutBalance: bigint;
  tokenInScalingFactor: bigint;
  tokenOutScalingFactor: bigint;
  tokenInWeight: bigint;
  tokenOutWeight: bigint;
  swapFee: bigint;
};

type StablePoolPairData = {
  balances: bigint[];
  indexIn: number;
  indexOut: number;
  scalingFactors: bigint[];
  swapFee: bigint;
  amp: bigint;
};

abstract class BaseGeneralPool extends BasePool {
  // Swap Hooks

  // Modification: this is inspired from the function onSwap which is in the original contract
  onSell(amounts: bigint[], poolPairData: StablePoolPairData): bigint[] {
    // _validateIndexes(indexIn, indexOut, _getTotalTokens());
    // uint256[] memory scalingFactors = _scalingFactors();
    return this._swapGivenIn(
      amounts,
      poolPairData.balances,
      poolPairData.indexIn,
      poolPairData.indexOut,
      poolPairData.scalingFactors,
      poolPairData.swapFee,
      poolPairData.amp,
    );
  }

  _swapGivenIn(
    tokenAmountsIn: bigint[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    scalingFactors: bigint[],
    _swapFeePercentage: bigint,
    _amplificationParameter: bigint,
  ): bigint[] {
    // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
    const tokenAmountsInWithFee = tokenAmountsIn.map(a =>
      this._subtractSwapFeeAmount(a, _swapFeePercentage),
    );

    const balancesUpscaled = this._upscaleArray(balances, scalingFactors);
    const tokenAmountsInScaled = tokenAmountsInWithFee.map(a =>
      this._upscale(a, scalingFactors[indexIn]),
    );

    const amountsOut = this._onSwapGivenIn(
      tokenAmountsInScaled,
      balancesUpscaled,
      indexIn,
      indexOut,
      _amplificationParameter,
    );

    // amountOut tokens are exiting the Pool, so we round down.
    return amountsOut.map(a =>
      this._downscaleDown(a, scalingFactors[indexOut]),
    );
  }

  /*
   * @dev Called when a swap with the Pool occurs, where the amount of tokens entering the Pool is known.
   *
   * Returns the amount of tokens that will be taken from the Pool in return.
   *
   * All amounts inside `swapRequest` and `balances` are upscaled. The swap fee has already been deducted from
   * `swapRequest.amount`.
   *
   * The return value is also considered upscaled, and will be downscaled (rounding down) before returning it to the
   * Vault.
   */
  abstract _onSwapGivenIn(
    tokenAmountsIn: bigint[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    _amplificationParameter: bigint,
  ): bigint[];
}

export class PrimaryIssuePool {
  vaultAddress: string;
  vaultInterface: Interface;

  constructor(vaultAddress: string, vaultInterface: Interface) {
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
  }

  getOnChainCalls(pool: SubgraphPoolBase): callData[] {
    return [
      {
        target: this.vaultAddress,
        callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
          pool.id,
        ]),
      },
    ];
  }

  decodeOnChainCalls(
    pool: SubgraphPoolBase,
    data: { success: boolean; returnData: any }[],
    startIndex: number,
  ): [{ [address: string]: PoolState }, number] {
    const pools = {} as { [address: string]: PoolState };

    const poolTokens = decodeThrowError(
      this.vaultInterface,
      'getPoolTokens',
      data[startIndex++],
      pool.address,
    );

    const poolState: PoolState = {
      tokens: poolTokens.tokens.reduce(
        (ptAcc: { [address: string]: TokenState }, pt: string, j: number) => {
          const tokenState: TokenState = {
            balance: BigInt(poolTokens.balances[j].toString()),
          };

          ptAcc[pt.toLowerCase()] = tokenState;
          return ptAcc;
        },
        {},
      ),
    };

    pools[pool.address] = poolState;

    return [pools, startIndex];
  }
}

export class SecondaryIssuePool {
  vaultAddress: string;
  vaultInterface: Interface;

  constructor(vaultAddress: string, vaultInterface: Interface) {
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
  }

  getOnChainCalls(pool: SubgraphPoolBase): callData[] {
    return [
      {
        target: this.vaultAddress,
        callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
          pool.id,
        ]),
      },
    ];
  }

  decodeOnChainCalls(
    pool: SubgraphPoolBase,
    data: { success: boolean; returnData: any }[],
    startIndex: number,
  ): [{ [address: string]: PoolState }, number] {
    const pools = {} as { [address: string]: PoolState };

    const poolTokens = decodeThrowError(
      this.vaultInterface,
      'getPoolTokens',
      data[startIndex++],
      pool.address,
    );

    const poolState: PoolState = {
      tokens: poolTokens.tokens.reduce(
        (ptAcc: { [address: string]: TokenState }, pt: string, j: number) => {
          const tokenState: TokenState = {
            balance: BigInt(poolTokens.balances[j].toString()),
          };

          ptAcc[pt.toLowerCase()] = tokenState;
          return ptAcc;
        },
        {},
      ),
    };

    pools[pool.address] = poolState;

    return [pools, startIndex];
  }
}

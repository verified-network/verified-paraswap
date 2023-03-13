import { Address } from '../../types';

// These should match the Verified Pool types available on Subgraph
export enum BalancerPoolTypes {
  PrimaryIssuePool = 'PrimaryIssuePool',
  SecondaryIssuePool = 'SecondaryIssuePool',
}

export type TokenState = {
  balance: bigint;
  scalingFactor?: bigint; // It includes the token priceRate
  weight?: bigint;
};

export type PoolState = {
  tokens: {
    [address: string]: TokenState;
  };
  //both Primary and Secondary issue Pools
  mainIndex?: number;
  wrappedIndex?: number;
  minimumOrderSize?: bigint;

  //only Primary issue pools
  minimumPrice?: bigint;
  securityOffered?: bigint;
  cutoffTime?: bigint;
};

export type SubgraphToken = {
  address: string;
  decimals: number;
};

export interface SubgraphMainToken extends SubgraphToken {
  poolToken: SubgraphToken;
  pathToToken: {
    poolId: string;
    poolAddress: string;
    token: SubgraphToken;
  }[];
}

export type SubgraphPoolAddressDictionary = {
  [address: string]: SubgraphPoolBase;
};

export interface SubgraphPoolBase {
  id: string;
  address: string;
  poolType: BalancerPoolTypes;
  tokens: SubgraphToken[];
  mainIndex: number;
  wrappedIndex: number;

  mainTokens: SubgraphMainToken[];
}

export type BalancerSwapV2 = {
  poolId: string;
  amount: string;
};

export type OptimizedBalancerV2Data = {
  swaps: BalancerSwapV2[];
};

export type BalancerFunds = {
  sender: string;
  recipient: string;
  fromInternalBalance: boolean;
  toInternalBalance: boolean;
};

// Indexes represent the index of the asset assets array param
export type BalancerSwap = {
  poolId: string;
  assetInIndex: number;
  assetOutIndex: number;
  amount: string;
  userData: string;
};

export enum SwapTypes {
  SwapExactIn,
  SwapExactOut,
}

export type BalancerParam = [
  kind: SwapTypes,
  swaps: BalancerSwap[],
  assets: string[],
  funds: BalancerFunds,
  limits: string[],
  deadline: string,
];

export type VerifiedData = {
  poolId: string;
  exchange: string;
};

export type DexParams = {
  subgraphURL: string;
  vaultAddress: Address;
};

export interface callData {
  target: string;
  callData: string;
}
export type PoolStateMap = { [address: string]: PoolState };

export interface PoolStateCache {
  blockNumber: number;
  poolState: PoolStateMap;
}

export const MIN_USD_LIQUIDITY_TO_FETCH = 100n;

// Let's take this trade as an example:
// https://dashboard.tenderly.co/paraswap/paraswap/fork/e4c81946-fd6e-4299-b35c-c47b775e3c05/simulation/8839462c-6239-4ae1-9ed0-8013f89b41de/gas-usage

// 271719 - 57856 - 79098 - 51041 = 83724 ~ 84k
export const STABLE_GAS_COST = 84_000;

// I see three pools used in trade: (57856 + 79098 + 51041) / 3 = 62665 ~ 63k
export const VARIABLE_GAS_COST_PER_CYCLE = 63_000;

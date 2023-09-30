import { Config, Address, Token } from './types';

import { Network, PORT_TEST_SERVER, ETHER_ADDRESS } from './constants';
import { isETHAddress } from './utils';
import { RFQConfig } from './dex/generic-rfq/types';

// Hardcoded and environment values from which actual config is derived
type BaseConfig = {
  network: number;
  networkName: string;
  isTestnet: boolean;
  mainnetNetwork?: number;
  nativeTokenName?: string;
  nativeTokenSymbol: string;
  wrappedNativeTokenName?: string;
  wrappedNativeTokenSymbol?: string;
  wrappedNativeTokenAddress: Address;
  hasEIP1559: boolean;
  augustusAddress: Address;
  augustusRFQAddress: Address;
  tokenTransferProxyAddress: Address;
  multicallV2Address: Address;
  privateHttpProvider?: string;
  adapterAddresses: { [name: string]: Address };
  uniswapV2ExchangeRouterAddress: Address;
  uniswapV3EventLoggingSampleRate?: number;
  rfqConfigs: Record<string, RFQConfig>;
  rpcPollingMaxAllowedStateDelayInBlocks: number;
  rpcPollingBlocksBackToTriggerUpdate: number;
  hashFlowAuthToken?: string;
  hashFlowDisabledMMs: string[];
  swaapV2AuthToken?: string;
  forceRpcFallbackDexs: string[];
};

const baseConfigs: { [network: number]: BaseConfig } = {
  [Network.MAINNET]: {
    network: Network.MAINNET,
    networkName: 'Ethereum Mainnet',
    isTestnet: false,
    nativeTokenName: 'Ether',
    nativeTokenSymbol: 'ETH',
    wrappedNativeTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    hasEIP1559: true,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    augustusRFQAddress: '0xe92b586627ccA7a83dC919cc7127196d70f55a06',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    privateHttpProvider: process.env.HTTP_PROVIDER_1,
    adapterAddresses: {
      Adapter01: '0x9bE264469eF954c139Da4A45Cf76CbCC5e3A6A73',
      Adapter02: '0xFC2Ba6E830a04C25e207B8214b26d8C713F6881F',
      Adapter03: '0xfb2a3de6c7B8c77b520E3da16021f3D8A4E93168',
      Adapter04: '0x30F6B9b6485ff0B67E881f5ac80D3F1c70A4B23d',
      BuyAdapter: '0x613876f3dE2Ec633f8054fE7a561324c1a01d9cB',
    },
    uniswapV2ExchangeRouterAddress:
      '0xF9234CB08edb93c0d4a4d4c70cC3FfD070e78e07',
    rpcPollingMaxAllowedStateDelayInBlocks: 0,
    rpcPollingBlocksBackToTriggerUpdate: 0,
    swaapV2AuthToken: process.env.API_KEY_SWAAP_V2_AUTH_TOKEN || '',
    hashFlowAuthToken: process.env.API_KEY_HASHFLOW_AUTH_TOKEN || '',
    hashFlowDisabledMMs:
      process.env[`HASHFLOW_DISABLED_MMS_1`]?.split(',') || [],
    uniswapV3EventLoggingSampleRate: 0,
    rfqConfigs: {
      DummyParaSwapPool: {
        maker: process.env.TEST_ADDRESS!,
        tokensConfig: {
          reqParams: {
            url: `http://localhost:${PORT_TEST_SERVER}/tokens`,
            method: 'GET',
          },
          secret: {
            domain: 'paraswap-test',
            accessKey: 'access',
            secretKey: 'secret',
          },
          intervalMs: 1000 * 60 * 60 * 10, // every 10 minutes
          dataTTLS: 1000 * 60 * 60 * 11, // ttl 11 minutes
        },
        pairsConfig: {
          reqParams: {
            url: `http://localhost:${PORT_TEST_SERVER}/pairs`,
            method: 'GET',
          },
          secret: {
            domain: 'paraswap-test',
            accessKey: 'access',
            secretKey: 'secret',
          },
          intervalMs: 1000 * 60 * 60 * 10, // every 10 minutes
          dataTTLS: 1000 * 60 * 60 * 11, // ttl 11 minutes
        },
        rateConfig: {
          reqParams: {
            url: `http://localhost:${PORT_TEST_SERVER}/prices`,
            method: 'GET',
          },
          secret: {
            domain: 'paraswap-test',
            accessKey: 'access',
            secretKey: 'secret',
          },
          intervalMs: 1000 * 60 * 60 * 1, // every 1 minute
          dataTTLS: 1000 * 60 * 60 * 1, // ttl 1 minute
        },
        firmRateConfig: {
          url: `http://localhost:${PORT_TEST_SERVER}/firm`,
          method: 'POST',
          secret: {
            domain: 'paraswap-test',
            accessKey: 'access',
            secretKey: 'secret',
          },
        },
      },
    },
    forceRpcFallbackDexs: [],
  },
  [Network.ROPSTEN]: {
    network: Network.ROPSTEN,
    networkName: 'Ethereum Ropsten Testnet',
    isTestnet: true,
    mainnetNetwork: Network.MAINNET,
    nativeTokenName: 'Ether',
    nativeTokenSymbol: 'ETH',
    wrappedNativeTokenAddress: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    hasEIP1559: true,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    augustusRFQAddress: '0x34268C38fcbC798814b058656bC0156C7511c0E4',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    privateHttpProvider: process.env.HTTP_PROVIDER_3,
    hashFlowDisabledMMs:
      process.env[`HASHFLOW_DISABLED_MMS_3`]?.split(',') || [],

    adapterAddresses: {
      RopstenAdapter01: '0x59b7F6258e78C3E5234bb651656EDd0e08868cd5',
      RopstenBuyAdapter: '0x63e908A4C793a33e40254362ED1A5997a234D85C',
    },
    uniswapV2ExchangeRouterAddress:
      '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
    rfqConfigs: {},
    rpcPollingMaxAllowedStateDelayInBlocks: 5,
    rpcPollingBlocksBackToTriggerUpdate: 3,
    forceRpcFallbackDexs: [],
  },
  [Network.BSC]: {
    network: Network.BSC,
    networkName: 'Binance Smart Chain Mainnet',
    isTestnet: false,
    nativeTokenSymbol: 'BNB',
    wrappedNativeTokenAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    hasEIP1559: false,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    augustusRFQAddress: '0x8DcDfe88EF0351f27437284D0710cD65b20288bb',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0xC50F4c1E81c873B2204D7eFf7069Ffec6Fbe136D',
    privateHttpProvider: process.env.HTTP_PROVIDER_56,
    hashFlowAuthToken: process.env.API_KEY_HASHFLOW_AUTH_TOKEN || '',
    hashFlowDisabledMMs:
      process.env[`HASHFLOW_DISABLED_MMS_56`]?.split(',') || [],
    adapterAddresses: {
      BscAdapter01: '0xA31d9C571DF00e0F428B0bD24c34D103E8112222',
      BscAdapter02: '0x02f2c31ebDE63E871AD0E74c01E21c819292a59D',
      BscBuyAdapter: '0x301c2813e3ceb43A448a12f21551EDBcdC37F157',
    },
    rpcPollingMaxAllowedStateDelayInBlocks: 1,
    rpcPollingBlocksBackToTriggerUpdate: 1,
    uniswapV2ExchangeRouterAddress:
      '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
    rfqConfigs: {},
    forceRpcFallbackDexs: [],
  },
  [Network.POLYGON]: {
    network: Network.POLYGON,
    networkName: 'Polygon Mainnet',
    isTestnet: false,
    nativeTokenName: 'Matic',
    nativeTokenSymbol: 'MATIC',
    wrappedNativeTokenAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    hasEIP1559: true,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    augustusRFQAddress: '0xF3CD476C3C4D3Ac5cA2724767f269070CA09A043',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0x275617327c958bD06b5D6b871E7f491D76113dd8',
    privateHttpProvider: process.env.HTTP_PROVIDER_137,
    hashFlowAuthToken: process.env.API_KEY_HASHFLOW_AUTH_TOKEN || '',
    hashFlowDisabledMMs:
      process.env[`HASHFLOW_DISABLED_MMS_137`]?.split(',') || [],
    adapterAddresses: {
      PolygonAdapter01: '0xE44769f42E1e9592f86B82f206407a8f7C84b4ed',
      PolygonAdapter02: '0x654cD2Cf97D23059B3db4FaA38BB2b1F8351211d',
      PolygonBuyAdapter: '0x4426a1F87Ee7e366542c58e29c02AFa2b5878b37',
    },
    uniswapV2ExchangeRouterAddress:
      '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
    uniswapV3EventLoggingSampleRate: 0,
    rfqConfigs: {},
    rpcPollingMaxAllowedStateDelayInBlocks: 2,
    rpcPollingBlocksBackToTriggerUpdate: 1,
    swaapV2AuthToken: process.env.API_KEY_SWAAP_V2_AUTH_TOKEN || '',
    forceRpcFallbackDexs: [],
  },
  [Network.AVALANCHE]: {
    network: Network.AVALANCHE,
    networkName: 'Avalanche Mainnet C-Chain',
    isTestnet: false,
    nativeTokenName: 'Avax',
    nativeTokenSymbol: 'AVAX',
    wrappedNativeTokenAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    hasEIP1559: true,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    augustusRFQAddress: '0x34302c4267d0dA0A8c65510282Cc22E9e39df51f',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0xd7Fc8aD069f95B6e2835f4DEff03eF84241cF0E1',
    privateHttpProvider: process.env.HTTP_PROVIDER_43114,
    hashFlowAuthToken: process.env.API_KEY_HASHFLOW_AUTH_TOKEN || '',
    hashFlowDisabledMMs:
      process.env[`HASHFLOW_DISABLED_MMS_43114`]?.split(',') || [],
    adapterAddresses: {
      AvalancheAdapter01: '0x745Ec73855CeC7249E5fF4c9DD81cc65b4D297a9',
      AvalancheAdapter02: '0xFb8773AA4Fd02e54bbd352061D8Be1911FAa210a',
      AvalancheBuyAdapter: '0x434C1Cca4842629230067674Dd54E21a14D9FD5D',
    },
    uniswapV2ExchangeRouterAddress:
      '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
    rfqConfigs: {},
    rpcPollingMaxAllowedStateDelayInBlocks: 2,
    rpcPollingBlocksBackToTriggerUpdate: 1,
    forceRpcFallbackDexs: [],
  },
  [Network.FANTOM]: {
    network: Network.FANTOM,
    networkName: 'Fantom Opera Mainnet',
    isTestnet: false,
    nativeTokenName: 'Fantom',
    nativeTokenSymbol: 'FTM',
    wrappedNativeTokenAddress: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
    hasEIP1559: false,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    augustusRFQAddress: '0x2DF17455B96Dde3618FD6B1C3a9AA06D6aB89347',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0xdC6E2b14260F972ad4e5a31c68294Fba7E720701',
    privateHttpProvider: process.env.HTTP_PROVIDER_250,
    hashFlowAuthToken: process.env.API_KEY_HASHFLOW_AUTH_TOKEN || '',
    hashFlowDisabledMMs:
      process.env[`HASHFLOW_DISABLED_MMS_250`]?.split(',') || [],

    adapterAddresses: {
      FantomAdapter01: '0x434C1Cca4842629230067674Dd54E21a14D9FD5D',
      FantomBuyAdapter: '0xb2634B3CBc1E401AB3C2743DB44d459C5c9aA662',
    },
    uniswapV2ExchangeRouterAddress:
      '0xAB86e2bC9ec5485a9b60E684BA6d49bf4686ACC2',
    rfqConfigs: {},
    rpcPollingMaxAllowedStateDelayInBlocks: 2,
    rpcPollingBlocksBackToTriggerUpdate: 1,
    forceRpcFallbackDexs: [],
  },
  [Network.ARBITRUM]: {
    network: Network.ARBITRUM,
    networkName: 'Arbitrum One',
    isTestnet: false,
    nativeTokenName: 'Ether',
    nativeTokenSymbol: 'ETH',
    wrappedNativeTokenAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    hasEIP1559: false,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    augustusRFQAddress: '0x0927FD43a7a87E3E8b81Df2c44B03C4756849F6D',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0x7eCfBaa8742fDf5756DAC92fbc8b90a19b8815bF',
    privateHttpProvider: process.env.HTTP_PROVIDER_42161,
    hashFlowAuthToken: process.env.API_KEY_HASHFLOW_AUTH_TOKEN || '',
    hashFlowDisabledMMs:
      process.env[`HASHFLOW_DISABLED_MMS_42161`]?.split(',') || [],
    adapterAddresses: {
      ArbitrumAdapter01: '0xD8134ACfc9c71Ab51452b5bA23A31354F4739032',
      ArbitrumAdapter02: '0xD1F70c98a78d48A93F0B4dDa49057469dc5aC126',
      ArbitrumBuyAdapter: '0x434C1Cca4842629230067674Dd54E21a14D9FD5D',
    },
    uniswapV2ExchangeRouterAddress:
      '0xB41dD984730dAf82f5C41489E21ac79D5e3B61bC',
    uniswapV3EventLoggingSampleRate: 0,
    rfqConfigs: {},
    rpcPollingMaxAllowedStateDelayInBlocks: 4,
    rpcPollingBlocksBackToTriggerUpdate: 3,
    forceRpcFallbackDexs: [],
  },
  [Network.OPTIMISM]: {
    network: Network.OPTIMISM,
    networkName: 'Optimistic Ethereum',
    isTestnet: false,
    nativeTokenName: 'Ether',
    nativeTokenSymbol: 'ETH',
    wrappedNativeTokenAddress: '0x4200000000000000000000000000000000000006',
    hasEIP1559: false,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    augustusRFQAddress: '0x0927FD43a7a87E3E8b81Df2c44B03C4756849F6D',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0x2DC0E2aa608532Da689e89e237dF582B783E552C',
    privateHttpProvider: process.env.HTTP_PROVIDER_10,
    hashFlowAuthToken: process.env.API_KEY_HASHFLOW_AUTH_TOKEN || '',
    hashFlowDisabledMMs:
      process.env[`HASHFLOW_DISABLED_MMS_10`]?.split(',') || [],

    adapterAddresses: {
      OptimismAdapter01: '0x3ad7f275E27AC579cA88e0b4765828242A9E8C49',
      OptimismBuyAdapter: '0xfdDD975FE4c1af20c24A3Ad2b33e8609a62DDC73',
    },
    uniswapV2ExchangeRouterAddress:
      '0xB41dD984730dAf82f5C41489E21ac79D5e3B61bC',
    uniswapV3EventLoggingSampleRate: 0,
    rfqConfigs: {},
    rpcPollingMaxAllowedStateDelayInBlocks: 5,
    rpcPollingBlocksBackToTriggerUpdate: 3,
    forceRpcFallbackDexs: [],
  },
  [Network.ZKEVM]: {
    network: Network.ZKEVM,
    networkName: 'Polygon zkEVM',
    isTestnet: false,
    nativeTokenName: 'Ether',
    nativeTokenSymbol: 'ETH',
    wrappedNativeTokenAddress: '0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9',
    hasEIP1559: true,
    augustusAddress: '0xB83B554730d29cE4Cb55BB42206c3E2c03E4A40A',
    augustusRFQAddress: '0x7Ee1F7fa4C0b2eDB0Fdd5944c14A07167700486E',
    tokenTransferProxyAddress: '0xc8a21fcd5a100c3ecc037c97e2f9c53a8d3a02a1',
    multicallV2Address: '0x6cA478C852DfA8941FC819fDf248606eA04780B6',
    privateHttpProvider: process.env.HTTP_PROVIDER_1101,
    adapterAddresses: {
      PolygonZkEvmAdapter01: '0xd63B7691dD98fa89A2ea5e1604700489c585aa7B',
      PolygonZkEvmBuyAdapter: '0xe2137168CdA486a2555E16c597905854C84F9127',
    },

    rpcPollingMaxAllowedStateDelayInBlocks: 0,
    rpcPollingBlocksBackToTriggerUpdate: 0,
    hashFlowAuthToken: process.env.API_KEY_HASHFLOW_AUTH_TOKEN || '',
    hashFlowDisabledMMs:
      process.env[`HASHFLOW_DISABLED_MMS_10`]?.split(',') || [],
    uniswapV3EventLoggingSampleRate: 0,
    rfqConfigs: {},
    forceRpcFallbackDexs: [],
    // FIXME: Not set properly
    uniswapV2ExchangeRouterAddress: '',
  },
  [Network.BASE]: {
    network: Network.BASE,
    networkName: 'Base',
    isTestnet: false,
    nativeTokenName: 'Ether',
    nativeTokenSymbol: 'ETH',
    wrappedNativeTokenAddress: '0x4200000000000000000000000000000000000006',
    hasEIP1559: false,
    augustusAddress: '0x59C7C832e96D2568bea6db468C1aAdcbbDa08A52',
    augustusRFQAddress: '0xa003dFBA51C9e1e56C67ae445b852bdEd7aC5EEd',
    tokenTransferProxyAddress: '0x93aAAe79a53759cD164340E4C8766E4Db5331cD7',
    multicallV2Address: '0xeDF6D2a16e8081F777eB623EeB4411466556aF3d',
    privateHttpProvider: process.env.HTTP_PROVIDER_8453,
    hashFlowAuthToken: process.env.API_KEY_HASHFLOW_AUTH_TOKEN || '',
    hashFlowDisabledMMs: [],
    adapterAddresses: {
      BaseAdapter01: '0x30F6B9b6485ff0B67E881f5ac80D3F1c70A4B23d',
      BaseBuyAdapter: '0xB11bCA7B01b425afD0743A4D77B4f593883f94C0',
    },
    uniswapV2ExchangeRouterAddress:
      '0x75d199EfB540e47D27D52c62Da3E7daC2B9e834F',
    uniswapV3EventLoggingSampleRate: 0,
    rfqConfigs: {},
    rpcPollingMaxAllowedStateDelayInBlocks: 5,
    rpcPollingBlocksBackToTriggerUpdate: 3,
    forceRpcFallbackDexs: [],
  },
};

// Should not be used, except by internal test code
export function generateConfig(network: number): Config {
  const baseConfig = baseConfigs[network];
  if (!baseConfig) {
    throw new Error(`No configuration found for network ${network}`);
  }
  const nativeTokenName =
    baseConfig.nativeTokenName || baseConfig.nativeTokenSymbol;
  if (!baseConfig.privateHttpProvider) {
    throw new Error(`Missing HTTP Provider for network ${network}`);
  }
  return {
    network: baseConfig.network,
    networkName: baseConfig.networkName,
    isTestnet: baseConfig.isTestnet,
    mainnetNetwork: baseConfig.mainnetNetwork,
    nativeTokenName,
    nativeTokenSymbol: baseConfig.nativeTokenSymbol,
    wrappedNativeTokenName:
      baseConfig.wrappedNativeTokenName || `Wrapped ${nativeTokenName}`,
    wrappedNativeTokenSymbol:
      baseConfig.wrappedNativeTokenSymbol || `W${baseConfig.nativeTokenSymbol}`,
    wrappedNativeTokenAddress: baseConfig.wrappedNativeTokenAddress,
    hasEIP1559: baseConfig.hasEIP1559,
    augustusAddress: baseConfig.augustusAddress,
    augustusRFQAddress: baseConfig.augustusRFQAddress,
    tokenTransferProxyAddress: baseConfig.tokenTransferProxyAddress,
    multicallV2Address: baseConfig.multicallV2Address,
    privateHttpProvider: baseConfig.privateHttpProvider,
    adapterAddresses: { ...baseConfig.adapterAddresses },
    uniswapV2ExchangeRouterAddress: baseConfig.uniswapV2ExchangeRouterAddress,
    uniswapV3EventLoggingSampleRate: baseConfig.uniswapV3EventLoggingSampleRate,
    rfqConfigs: baseConfig.rfqConfigs,
    rpcPollingMaxAllowedStateDelayInBlocks:
      baseConfig.rpcPollingMaxAllowedStateDelayInBlocks,
    rpcPollingBlocksBackToTriggerUpdate:
      baseConfig.rpcPollingBlocksBackToTriggerUpdate,
    hashFlowAuthToken: baseConfig.hashFlowAuthToken,
    swaapV2AuthToken: baseConfig.swaapV2AuthToken,
    hashFlowDisabledMMs: baseConfig.hashFlowDisabledMMs,
    forceRpcFallbackDexs: baseConfig.forceRpcFallbackDexs,
  };
}

export class ConfigHelper {
  public masterBlockNumberCacheKey: string;

  constructor(
    public isSlave: boolean,
    public data: Config,
    masterCachePrefix: string,
  ) {
    this.masterBlockNumberCacheKey =
      `${masterCachePrefix}_${data.network}_bn`.toLowerCase();
  }

  wrapETH(token: Token): Token {
    return isETHAddress(token.address)
      ? { address: this.data.wrappedNativeTokenAddress, decimals: 18 }
      : token;
  }

  unwrapETH(token: Token): Token {
    return this.isWETH(token.address)
      ? { address: ETHER_ADDRESS, decimals: 18 }
      : token;
  }

  isWETH(tokenAddress: Address): boolean {
    return (
      tokenAddress.toLowerCase() ===
      this.data.wrappedNativeTokenAddress.toLowerCase()
    );
  }
}

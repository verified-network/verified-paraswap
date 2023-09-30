import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

function testForNetwork(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
  nativeTokenAmount: string,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];
  const nativeTokenSymbol = NativeTokenSymbols[network];

  // TODO: Add any direct swap contractMethod name if it exists
  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        ContractMethod.multiSwap,
        ContractMethod.megaSwap,
      ],
    ],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[nativeTokenSymbol],
                tokens[tokenASymbol],
                holders[nativeTokenSymbol],
                side === SwapSide.SELL ? nativeTokenAmount : tokenAAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
              await testE2E(
                tokens[tokenASymbol],
                tokens[nativeTokenSymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenAAmount : nativeTokenAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
              await testE2E(
                tokens[tokenASymbol],
                tokens[tokenBSymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        });
      }),
    );
  });
}

describe('Solidly E2E', () => {
  describe('Fantom', () => {
    const network = Network.FANTOM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe(`Solidly`, () => {
      const dexKey = 'Solidly';

      describe(`simpleSwap`, () => {
        describe(`Volatile`, () => {
          it('FTM -> USDC', async () => {
            await testE2E(
              tokens.FTM,
              tokens.USDC,
              holders.FTM,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
          it('FTM -> SPIRIT', async () => {
            await testE2E(
              tokens.FTM,
              tokens.SPIRIT,
              holders.FTM,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
          it('SPIRIT -> FTM', async () => {
            await testE2E(
              tokens.SPIRIT,
              tokens.FTM,
              holders.SPIRIT,
              '11000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
          it('SPIRIT -> WFTM', async () => {
            await testE2E(
              tokens.SPIRIT,
              tokens.WFTM,
              holders.SPIRIT,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
        });
        describe(`Stable`, () => {
          it('USDC -> USDT', async () => {
            await testE2E(
              tokens.USDC,
              tokens.FUSDT,
              holders.USDC,
              '100000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
        });
      });
      describe(`multiSwap`, () => {
        describe(`Volatile`, () => {
          it('FTM -> USDC', async () => {
            await testE2E(
              tokens.FTM,
              tokens.USDC,
              holders.FTM,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
          it('FTM -> SPIRIT', async () => {
            await testE2E(
              tokens.FTM,
              tokens.SPIRIT,
              holders.FTM,
              '11000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
          it('SPIRIT -> FTM', async () => {
            await testE2E(
              tokens.SPIRIT,
              tokens.FTM,
              holders.SPIRIT,
              '11000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
          it('SPIRIT -> WFTM', async () => {
            await testE2E(
              tokens.SPIRIT,
              tokens.WFTM,
              holders.SPIRIT,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });
        describe(`Stable`, () => {
          it('USDC -> USDT', async () => {
            await testE2E(
              tokens.USDC,
              tokens.FUSDT,
              holders.USDC,
              '100000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });
      });
    });

    describe('SpiritSwapV2', () => {
      const dexKey = 'SpiritSwapV2';
      describe(`simpleSwap`, () => {
        describe(`Volatile`, () => {
          it('FTM -> USDC', async () => {
            await testE2E(
              tokens.FTM,
              tokens.USDC,
              holders.FTM,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
          it('FTM -> SPIRIT', async () => {
            await testE2E(
              tokens.FTM,
              tokens.SPIRIT,
              holders.FTM,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
          it('SPIRIT -> FTM', async () => {
            await testE2E(
              tokens.SPIRIT,
              tokens.FTM,
              holders.SPIRIT,
              '11000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
          it('SPIRIT -> WFTM', async () => {
            await testE2E(
              tokens.SPIRIT,
              tokens.WFTM,
              holders.SPIRIT,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
        });
        describe(`Stable`, () => {
          it('USDC -> USDT', async () => {
            await testE2E(
              tokens.USDC,
              tokens.FUSDT,
              holders.USDC,
              '100000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
        });
      });
      describe(`multiSwap`, () => {
        describe(`Volatile`, () => {
          it('FTM -> USDC', async () => {
            await testE2E(
              tokens.FTM,
              tokens.USDC,
              holders.FTM,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
          it('FTM -> SPIRIT', async () => {
            await testE2E(
              tokens.FTM,
              tokens.SPIRIT,
              holders.FTM,
              '11000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
          it('SPIRIT -> FTM', async () => {
            await testE2E(
              tokens.SPIRIT,
              tokens.FTM,
              holders.SPIRIT,
              '11000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
          it('SPIRIT -> WFTM', async () => {
            await testE2E(
              tokens.SPIRIT,
              tokens.WFTM,
              holders.SPIRIT,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });
        describe(`Stable`, () => {
          it('USDC -> USDT', async () => {
            await testE2E(
              tokens.USDC,
              tokens.FUSDT,
              holders.USDC,
              '100000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });
      });
    });

    describe('Equalizer', () => {
      const dexKey = 'Equalizer';
      const network = Network.FANTOM;

      const tokenASymbol: string = 'FUSDT';
      const tokenBSymbol: string = 'USDC';

      const tokenAAmount: string = '111110';
      const tokenBAmount: string = '100000';
      const nativeTokenAmount = '11000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
      );
    });
  });

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe(`SolidlyV2`, () => {
      const dexKey = 'SolidlyV2';

      describe(`simpleSwap`, () => {
        describe(`Volatile`, () => {
          it('ETH -> USDC', async () => {
            await testE2E(
              tokens.ETH,
              tokens.USDC,
              holders.ETH,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
        });
        describe(`Stable`, () => {
          it('USDC -> USDT', async () => {
            await testE2E(
              tokens.USDC,
              tokens.USDT,
              holders.USDC,
              '10000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
        });
      });

      describe(`multiSwap`, () => {
        describe(`Volatile`, () => {
          it('ETH -> USDC', async () => {
            await testE2E(
              tokens.ETH,
              tokens.USDC,
              holders.ETH,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });
        describe(`Stable`, () => {
          it('USDC -> USDT', async () => {
            await testE2E(
              tokens.USDC,
              tokens.USDT,
              holders.USDC,
              '10000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });
      });
    });
  });

  describe('Polygon', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('Dystopia', () => {
      const dexKey = 'Dystopia';
      const usdAmount = '1000000';

      describe('Dystopia UniswapV2 Pools', () => {
        const maticAmount = '1000000000000000000';

        describe('simpleSwap', () => {
          it('MATIC -> TOKEN', async () => {
            await testE2E(
              tokens.MATIC,
              tokens.WETH,
              holders.MATIC,
              maticAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });

          it('Token -> MATIC', async () => {
            await testE2E(
              tokens.USDT,
              tokens.MATIC,
              holders.USDT,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });

          it('Token -> Token', async () => {
            await testE2E(
              tokens.WMATIC,
              tokens.WETH,
              holders.WMATIC,
              maticAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
        });

        describe('multiSwap', () => {
          it('MATIC -> TOKEN', async () => {
            await testE2E(
              tokens.MATIC,
              tokens.WETH,
              holders.MATIC,
              maticAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });

          it('Token -> MATIC', async () => {
            await testE2E(
              tokens.USDT,
              tokens.MATIC,
              holders.USDT,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });

          it('Token -> Token', async () => {
            await testE2E(
              tokens.WMATIC,
              tokens.WETH,
              holders.WMATIC,
              maticAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });

        describe('megaSwap', () => {
          it('MATIC -> TOKEN', async () => {
            await testE2E(
              tokens.USDT,
              tokens.MATIC,
              holders.USDT,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.megaSwap,
              network,
              provider,
            );
          });

          it('Token -> MATIC', async () => {
            await testE2E(
              tokens.USDT,
              tokens.MATIC,
              holders.USDT,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.megaSwap,
              network,
              provider,
            );
          });

          it('Token -> Token', async () => {
            await testE2E(
              tokens.WMATIC,
              tokens.WETH,
              holders.WMATIC,
              maticAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.megaSwap,
              network,
              provider,
            );
          });
        });
      });

      describe('Dystopia Stable Pools', () => {
        describe('simpleSwap', () => {
          it('Token -> Token', async () => {
            await testE2E(
              tokens.USDC,
              tokens.USDT,
              holders.USDC,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
        });

        describe('multiSwap', () => {
          it('Token -> Token', async () => {
            await testE2E(
              tokens.USDC,
              tokens.USDT,
              holders.USDC,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });

        describe('megaSwap', () => {
          it('Token -> Token', async () => {
            await testE2E(
              tokens.USDC,
              tokens.USDT,
              holders.USDC,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.megaSwap,
              network,
              provider,
            );
          });
        });
      });
    });
  });

  describe('Optimism', () => {
    const network = Network.OPTIMISM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('Velodrome', () => {
      const dexKey = 'Velodrome';

      describe('simpleSwap', () => {
        it('NATIVE -> TOKEN', async () => {
          await testE2E(
            tokens.ETH,
            tokens.USDC,
            holders.ETH,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
        it('TOKEN -> NATIVE', async () => {
          await testE2E(
            tokens.USDC,
            tokens.ETH,
            holders.USDC,
            '9900000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
        it('TOKEN -> TOKEN', async () => {
          await testE2E(
            tokens.WETH,
            tokens.USDC,
            holders.WETH,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,

            network,
            provider,
          );
        });
      });
      describe('multiSwap', () => {
        it('NATIVE -> TOKEN', async () => {
          await testE2E(
            tokens.ETH,
            tokens.USDC,
            holders.ETH,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,

            network,
            provider,
          );
        });
        it('TOKEN -> NATIVE', async () => {
          await testE2E(
            tokens.USDC,
            tokens.ETH,
            holders.USDC,
            '9900000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
        it('TOKEN -> TOKEN', async () => {
          await testE2E(
            tokens.WETH,
            tokens.USDC,
            holders.WETH,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
      });
    });

    describe('VelodromeV2', () => {
      const dexKey = 'VelodromeV2';

      const network = Network.OPTIMISM;

      const tokenASymbol: string = 'USDC';
      const tokenBSymbol: string = 'USDT';

      const tokenAAmount: string = '111110000';
      const tokenBAmount: string = '1100000000';
      const nativeTokenAmount = '11000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
      );
    });
  });

  describe('BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('Cone', () => {
      const dexKey = 'Cone';
      const usdAmount = '1000000';

      describe('Cone UniswapV2 Pools', () => {
        const bnbAmount = '1000000000000000000';

        describe('simpleSwap', () => {
          it('BNB -> TOKEN', async () => {
            await testE2E(
              tokens.BNB,
              tokens.BUSD,
              holders.BNB,
              bnbAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });

          it('Token -> BNB', async () => {
            await testE2E(
              tokens.USDT,
              tokens.BNB,
              holders.USDT,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });

          it('Token -> Token', async () => {
            await testE2E(
              tokens.WBNB,
              tokens.CONE,
              holders.WBNB,
              bnbAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
        });

        describe('multiSwap', () => {
          it('BNB -> TOKEN', async () => {
            await testE2E(
              tokens.BNB,
              tokens.BUSD,
              holders.BNB,
              bnbAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });

          it('Token -> BNB', async () => {
            await testE2E(
              tokens.USDT,
              tokens.BNB,
              holders.USDT,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });

          it('Token -> Token', async () => {
            await testE2E(
              tokens.WBNB,
              tokens.CONE,
              holders.WBNB,
              bnbAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });

        describe('megaSwap', () => {
          it('BNB -> TOKEN', async () => {
            await testE2E(
              tokens.USDT,
              tokens.BNB,
              holders.USDT,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.megaSwap,
              network,
              provider,
            );
          });

          it('Token -> BNB', async () => {
            await testE2E(
              tokens.USDT,
              tokens.BNB,
              holders.USDT,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.megaSwap,
              network,
              provider,
            );
          });

          it('Token -> Token', async () => {
            await testE2E(
              tokens.WBNB,
              tokens.CONE,
              holders.WBNB,
              bnbAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.megaSwap,
              network,
              provider,
            );
          });
        });
      });

      describe('Cone Stable Pools', () => {
        describe('simpleSwap', () => {
          it('Token -> Token', async () => {
            await testE2E(
              tokens.USDC,
              tokens.USDT,
              holders.USDC,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.simpleSwap,
              network,
              provider,
            );
          });
        });

        describe('multiSwap', () => {
          it('Token -> Token', async () => {
            await testE2E(
              tokens.USDC,
              tokens.USDT,
              holders.USDC,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });

        describe('megaSwap', () => {
          it('Token -> Token', async () => {
            await testE2E(
              tokens.USDC,
              tokens.USDT,
              holders.USDC,
              usdAmount,
              SwapSide.SELL,
              dexKey,
              ContractMethod.megaSwap,
              network,
              provider,
            );
          });
        });
      });
    });

    describe('Thena', () => {
      const dexKey = 'Thena';

      const sideToContractMethods = new Map([
        [
          SwapSide.SELL,
          [
            ContractMethod.simpleSwap,
            ContractMethod.multiSwap,
            ContractMethod.megaSwap,
          ],
        ],
      ]);

      const pairs: { name: string; sellAmount: string }[][] = [
        [
          {
            name: 'BNB',
            sellAmount: '1000000000000000000',
          },
          {
            name: 'USDT',
            sellAmount: '10000000000000000000',
          },
        ],
        [
          {
            name: 'USDT',
            sellAmount: '10000000000000000000',
          },
          {
            name: 'USDC',
            sellAmount: '10000000000000000000',
          },
        ],
        [
          {
            name: 'ETH',
            sellAmount: '5000000000000000000',
          },
          {
            name: 'BNB',
            sellAmount: '1000000000000000000',
          },
        ],
      ];

      sideToContractMethods.forEach((contractMethods, side) =>
        describe(`${side}`, () => {
          contractMethods.forEach((contractMethod: ContractMethod) => {
            pairs.forEach(pair => {
              describe(`${contractMethod}`, () => {
                it(`${pair[0].name} -> ${pair[1].name}`, async () => {
                  await testE2E(
                    tokens[pair[0].name],
                    tokens[pair[1].name],
                    holders[pair[0].name],
                    pair[0].sellAmount,
                    side,
                    dexKey,
                    contractMethod,
                    network,
                    provider,
                  );
                });
                it(`${pair[1].name} -> ${pair[0].name}`, async () => {
                  await testE2E(
                    tokens[pair[1].name],
                    tokens[pair[0].name],
                    holders[pair[1].name],
                    pair[1].sellAmount,
                    side,
                    dexKey,
                    contractMethod,
                    network,
                    provider,
                  );
                });
              });
            });
          });
        }),
      );
    });
  });

  describe('Avalanche', () => {
    const network = Network.AVALANCHE;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('SoliSnek', () => {
      const dexKey = 'SoliSnek';

      describe('simpleSwap', () => {
        it('NATIVE -> TOKEN', async () => {
          await testE2E(
            tokens.AVAX,
            tokens.USDC,
            holders.AVAX,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
        it('TOKEN -> NATIVE', async () => {
          await testE2E(
            tokens.USDC,
            tokens.AVAX,
            holders.USDC,
            '9900000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
        it('TOKEN -> TOKEN', async () => {
          await testE2E(
            tokens.WAVAX,
            tokens.USDC,
            holders.WAVAX,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,

            network,
            provider,
          );
        });
      });
      describe('multiSwap', () => {
        it('NATIVE -> TOKEN', async () => {
          await testE2E(
            tokens.AVAX,
            tokens.USDC,
            holders.AVAX,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,

            network,
            provider,
          );
        });
        it('TOKEN -> NATIVE', async () => {
          await testE2E(
            tokens.USDC,
            tokens.AVAX,
            holders.USDC,
            '9900000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
        it('TOKEN -> TOKEN', async () => {
          await testE2E(
            tokens.WAVAX,
            tokens.USDC,
            holders.WAVAX,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
      });
    });
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe(`Chronos`, () => {
      const dexKey = 'Chronos';

      const sideToContractMethods = new Map([
        [
          SwapSide.SELL,
          [
            ContractMethod.simpleSwap,
            ContractMethod.multiSwap,
            ContractMethod.megaSwap,
          ],
        ],
      ]);

      const pairs: { name: string; sellAmount: string }[][] = [
        [
          {
            name: 'ETH',
            sellAmount: '1000000000000000000',
          },
          {
            name: 'USDC',
            sellAmount: '100000000',
          },
        ],
        [
          {
            name: 'USDT',
            sellAmount: '100000000',
          },
          {
            name: 'USDC',
            sellAmount: '100000000',
          },
        ],
        [
          {
            name: 'USDC',
            sellAmount: '100000000',
          },
          {
            name: 'DAI',
            sellAmount: '100000000000000000000',
          },
        ],
        [
          {
            name: 'ARB',
            sellAmount: '100000000',
          },
          {
            name: 'ETH',
            sellAmount: '100000000000000000000',
          },
        ],
      ];

      sideToContractMethods.forEach((contractMethods, side) =>
        describe(`${side}`, () => {
          contractMethods.forEach((contractMethod: ContractMethod) => {
            pairs.forEach(pair => {
              describe(`${contractMethod}`, () => {
                it(`${pair[0].name} -> ${pair[1].name}`, async () => {
                  await testE2E(
                    tokens[pair[0].name],
                    tokens[pair[1].name],
                    holders[pair[0].name],
                    pair[0].sellAmount,
                    side,
                    dexKey,
                    contractMethod,
                    network,
                    provider,
                  );
                });
                it(`${pair[1].name} -> ${pair[0].name}`, async () => {
                  await testE2E(
                    tokens[pair[1].name],
                    tokens[pair[0].name],
                    holders[pair[1].name],
                    pair[1].sellAmount,
                    side,
                    dexKey,
                    contractMethod,
                    network,
                    provider,
                  );
                });
              });
            });
          });
        }),
      );
    });

    describe('Ramses', () => {
      const dexKey = 'Ramses';

      const sideToContractMethods = new Map([
        [
          SwapSide.SELL,
          [
            ContractMethod.simpleSwap,
            ContractMethod.multiSwap,
            ContractMethod.megaSwap,
          ],
        ],
      ]);

      const pairs: { name: string; sellAmount: string }[][] = [
        [
          {
            name: 'ETH',
            sellAmount: '10000000000000',
          },
          {
            name: 'USDCe',
            sellAmount: '100000000',
          },
        ],
        [
          {
            name: 'WETH',
            sellAmount: '10000000000000',
          },
          {
            name: 'USDCe',
            sellAmount: '100000000',
          },
        ],
        [
          {
            name: 'USDT',
            sellAmount: '100000000',
          },
          {
            name: 'USDCe',
            sellAmount: '100000000',
          },
        ],
        [
          {
            name: 'USDCe',
            sellAmount: '500000',
          },
          {
            name: 'DAI',
            sellAmount: '1000000000000000000',
          },
        ],
      ];

      sideToContractMethods.forEach((contractMethods, side) =>
        describe(`${side}`, () => {
          contractMethods.forEach((contractMethod: ContractMethod) => {
            pairs.forEach(pair => {
              describe(`${contractMethod}`, () => {
                it(`${pair[0].name} -> ${pair[1].name}`, async () => {
                  await testE2E(
                    tokens[pair[0].name],
                    tokens[pair[1].name],
                    holders[pair[0].name],
                    pair[0].sellAmount,
                    side,
                    dexKey,
                    contractMethod,
                    network,
                    provider,
                  );
                });
                it(`${pair[1].name} -> ${pair[0].name}`, async () => {
                  await testE2E(
                    tokens[pair[1].name],
                    tokens[pair[0].name],
                    holders[pair[1].name],
                    pair[1].sellAmount,
                    side,
                    dexKey,
                    contractMethod,
                    network,
                    provider,
                  );
                });
              });
            });
          });
        }),
      );
    });
  });

  describe('Base', () => {
    const network = Network.BASE;

    describe('Aerodrome', () => {
      const dexKey = 'Aerodrome';
      const tokenASymbol: string = 'USDbC';
      const tokenBSymbol: string = 'DAI';

      const tokenAAmount: string = '1111100000';
      const tokenBAmount: string = '100000000000000000';
      const nativeTokenAmount = '100000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
      );
    });

    describe('Equalizer', () => {
      const dexKey = 'Equalizer';
      const network = Network.BASE;

      const tokenASymbol: string = 'USDbC';
      const tokenAAmount: string = '1111100000';
      const nativeTokenAmount = '110000000000000000';

      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );
      const tokens = Tokens[network];
      const holders = Holders[network];
      const nativeTokenSymbol = NativeTokenSymbols[network];

      // TODO: Add any direct swap contractMethod name if it exists
      const sideToContractMethods = new Map([
        [
          SwapSide.SELL,
          [
            ContractMethod.simpleSwap,
            ContractMethod.multiSwap,
            ContractMethod.megaSwap,
          ],
        ],
      ]);

      sideToContractMethods.forEach((contractMethods, side) =>
        describe(`${side}`, () => {
          contractMethods.forEach((contractMethod: ContractMethod) => {
            describe(`${contractMethod}`, () => {
              it(`${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
                await testE2E(
                  tokens[nativeTokenSymbol],
                  tokens[tokenASymbol],
                  holders[nativeTokenSymbol],
                  side === SwapSide.SELL ? nativeTokenAmount : tokenAAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              });
              it(`${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
                await testE2E(
                  tokens[tokenASymbol],
                  tokens[nativeTokenSymbol],
                  holders[tokenASymbol],
                  side === SwapSide.SELL ? tokenAAmount : nativeTokenAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              });
            });
          });
        }),
      );
    });
  });
});

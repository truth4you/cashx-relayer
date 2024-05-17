// const env = require("hardhat");
require("dotenv").config();
require("@nomiclabs/hardhat-waffle");
require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-etherscan");
// require('@openzeppelin/hardhat-upgrades')
// The next line is part of the sample project, you don't need it in your
// project. It imports a Hardhat task definition, that can be used for
// testing the frontend.
// require("./tasks/faucet");


// If you are using MetaMask, be sure to change the chainId to 1337
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.4.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.7.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.2",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.22",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          // viaIR: true
        }
      }
    ]
  },
  // contractSizer: {
  //   alphaSort: true,
  //   disambiguatePaths: false,
  //   runOnCompile: true,
  //   strict: false,
  //   only: [':NodeCore$','NodeManager$'],
  // },
  mining: {
    auto: false,
    interval: 1000
  },
  networks: {
    hardhat: {
      // chainId: 31337,
      forking: {
        //url: `https://mainnet.infura.io/v3/585a01358fdc405385f7dfc820942596`
        url: `https://rpc.ankr.com/eth_sepolia`
      },
    },
    chain1: {
      url: "http://localhost:8546/",
      chainId: 8546,
    },
    chain2: {
      url: "http://localhost:8547/",
      chainId: 8547,
    },
    chain3: {
      url: "http://localhost:8548/",
      chainId: 8548,
    },   
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [process.env.BSC_TESTNET_DEPLOYER] 
    },
    goerli: {
      url: "https://rpc.ankr.com/eth_goerli",
      chainId: 5,
      // gasPrice: 20000000000,
      accounts: [process.env.GOERLI_DEPLOYER] 
    },
    sepolia: {
      url: `https://rpc.ankr.com/eth_sepolia`,
      chainId: 11155111,
      // gasPrice: 20000000000,
      accounts: [process.env.SEPOLIA_DEPLOYER] 
    },
    basesepolia: {
      url: 'https://base-sepolia.publicnode.com',
      chainId: 84532,
      accounts: [process.env.SEPOLIA_DEPLOYER],
    },
    puppy: {
      url: "https://puppynet.shibrpc.com",
      chainId: 719,
      gasPrice: 20000000000,
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: "GJQFD5BXR754QEI1221TPAM94IRIE7B2FD",
      avalancheFujiTestnet: "ZGR21YGDGQSIVXI5B2NR5K73MFCDI4QPH8",
      ftmTestnet: "WF1AMWQ7AUZGPAUANYXDMIS3GWB9JJ4CHH",
      goerli: "HJNU2TCIRZBH4I3RTB98RI1MRJT8KSJCRG",
      sepolia: "HJNU2TCIRZBH4I3RTB98RI1MRJT8KSJCRG",
      basesepolia: "625N7GC5238WP837PCH6D9QI6TE1USBPDT",
      kovan: "55I2YRDX4453DEYQ94MHZUK33DE7MHQZCM",
      // puppy: "55I2YRDX4453DEYQ94MHZUK33DE7MHQZCM"
    },
    customChains: [
      {
        network: "basesepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
    ]
  },
  abiExporter: {
    path: './abi',
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
    pretty: true
  }
};

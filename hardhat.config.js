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
      chainId: 31337
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
      accounts: ["a49468e12797469ce53da63286054aa58b9374f3711a95f2dea0d06cbf3ba7f6"] 
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: "GJQFD5BXR754QEI1221TPAM94IRIE7B2FD",
      avalancheFujiTestnet: "ZGR21YGDGQSIVXI5B2NR5K73MFCDI4QPH8",
      ftmTestnet: "WF1AMWQ7AUZGPAUANYXDMIS3GWB9JJ4CHH",
      kovan: "55I2YRDX4453DEYQ94MHZUK33DE7MHQZCM"
    }
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

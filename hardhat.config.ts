import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

import "./tasks/add-vrf-consumer";
import "./tasks/enable-raffle";
import "./tasks/remove-vrf-consumer";
import "./tasks/verify-contracts";
import "./tasks/withdraw-raffle-funds";
const config: HardhatUserConfig = {
  typechain: {
    target: "ethers-v6",
  },
  mocha: {
    timeout: 1000000,
  },
  solidity: {
    compilers: [
      {
        version: "0.8.19",
      },
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 9999,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: process.env.FORKING == "true" ? 42161 : 31337,
      forking: {
        url:
          "https://arbitrum-mainnet.infura.io/v3/" +
          (process.env.INFURA_KEY !== undefined ? process.env.INFURA_KEY : ""),
        blockNumber: 203592328,
        enabled:
          process.env.FORKING !== undefined && process.env.FORKING == "true"
            ? true
            : false,
      },
      accounts: {
        count: 300,
      },
    },
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts:
        process.env.TESTNET_PRIVATE_KEY !== undefined
          ? [process.env.TESTNET_PRIVATE_KEY]
          : [],
    },
    arbitrumOne: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts:
        process.env.MAINNET_PRIVATE_KEY !== undefined
          ? [process.env.MAINNET_PRIVATE_KEY]
          : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS == "true" ? true : false,
    L2: "arbitrum",
    currency: "EUR",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    L2Etherscan: process.env.ARBISCAN_API_KEY,
  },
  etherscan: {
    apiKey: {
      arbitrumOne:
        process.env.ARBISCAN_API_KEY !== undefined
          ? process.env.ARBISCAN_API_KEY
          : "",
      arbitrumSepolia:
        process.env.ARBISCAN_API_KEY !== undefined
          ? process.env.ARBISCAN_API_KEY
          : "",
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    deployerMultisig: {
      default: 1,
    },
    admin: {
      default: "0xFfea3BE2d088DfAbCAf64837450919B53E40Fbe5",
      421614: "0xFfea3BE2d088DfAbCAf64837450919B53E40Fbe5",
      42161: "0xFfea3BE2d088DfAbCAf64837450919B53E40Fbe5",
    },
  },
};

export default config;

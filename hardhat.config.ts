import { HardhatUserConfig } from "hardhat/config";
import "hardhat-deploy";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-tracer";
import "hardhat-contract-sizer";
import dotenv from "dotenv";
dotenv.config();

const TEST_HDWALLET = {
  mnemonic: "test test test test test test test test test test test junk",
  path: "m/44'/60'/0'/0",
  initialIndex: 0,
  count: 20,
  passphrase: "",
};

const accounts = [
  process.env.DEPLOYER!,
  process.env.GOVERNANCE!,
  process.env.AGENT_BASE_USDC!,
  process.env.BENEFICIARY!,
  process.env.FEE_RECIPIENT!,
];
const { INFURA_KEY } = process.env;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 8453,
      gasPrice: 100e9,
      live: false,
      deploy: ["deploy/hardhat"],
    },
    base: {
      url: process.env.BASE_RPC_URL!,
      accounts: accounts,
      live: true,
      deploy: ["deploy/base"],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL!,
      accounts: accounts,
      chainId: 0xaa36a7,
      live: true,
      timeout: 120000, // 120s
      gasPrice: 2e10, // 20 Gwei
      deploy: ["deploy/sepolia"],
    },
    baseFork: {
      url: process.env.BASE_FORK_RPC_URL!,
      chainId: 8453, 
      accounts,
      gasPrice: 100e9,
      deploy: ["deploy/baseFork"],
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL!,
      accounts,
      live: true,
      gasPrice: 3e9, // 3 Gwei
      deploy: ["deploy/bscTestnet"],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    ],
  },

  mocha: {
    timeout: 200000,
    require: ["dd-trace/ci/init"],
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    governance: {
      default: 1,
    },
    agent: {
      default: 0, //1
    },
    beneficiary: {
      default: 3, //2
    },
    feeRecipient: {
      default: 4,
    },
  },
};
export default config;

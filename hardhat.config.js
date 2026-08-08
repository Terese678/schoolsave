// Hardhat setup for compiling and deploying SchoolSave's contracts.

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import "dotenv/config"; // loads PRIVATE_KEY and other secrets from .env, keeps them out of this file

const PRIVATE_KEY = process.env.PRIVATE_KEY;

/** @type {import('hardhat/config').HardhatUserConfig} */
export default {
  plugins: [hardhatToolboxMochaEthersPlugin, hardhatVerify],

  // Must match the version used in the .sol files.
  solidity: "0.8.24",

  networks: {
    // BOT Chain testnet, used for all development and testing before mainnet.
    botchainTestnet: {
      type: "http",
      url: "https://rpc.bohr.life",
      chainId: 968,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },

    // BOT Chain mainnet, real network, real gas, real deployment.
    botchainMainnet: {
      type: "http",
      url: "https://rpc.botchain.ai",
      chainId: 677,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },

  etherscan: {
    apiKey: {
      botchainMainnet: "empty",
    },
    customChains: [
      {
        network: "botchainMainnet",
        chainId: 677,
        urls: {
          apiURL: "https://scan.botchain.ai/api",
          browserURL: "https://scan.botchain.ai",
        },
      },
    ],
  },
};
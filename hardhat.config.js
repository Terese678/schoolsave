// Hardhat 3 config file, written as an ES module since package.json has "type": "module" set.
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

/** @type {import('hardhat/config').HardhatUserConfig} */
export default {
  // Register the toolbox plugin so its features, like compiling and testing, are available.
  plugins: [hardhatToolboxMochaEthersPlugin],

  // Which Solidity compiler version to use for our contracts. 0.8.24 is a stable, modern version with built in overflow protection.
  solidity: "0.8.24",
};
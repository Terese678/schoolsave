// Deploys SchoolSaveVault to whichever network is passed via --network.
// Usage: npx hardhat run scripts/deploy.js --network botchainTestnet

import hre from "hardhat";

async function main() {
  const { ethers } = await hre.network.getOrCreate();

  // The wallet deploying the contract also becomes the fee collector for now,
  // since we don't have a separate treasury address set up yet.
  const [deployer] = await ethers.getSigners();

  const SchoolSaveVault = await ethers.getContractFactory("SchoolSaveVault");
  const vault = await SchoolSaveVault.deploy(deployer.address);
  await vault.waitForDeployment();

  console.log("SchoolSaveVault deployed to:", await vault.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
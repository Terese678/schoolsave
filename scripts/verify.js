import hre from "hardhat";
import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";

await verifyContract(
  {
    address: "0x9Be792Fc6bd54F4AeC95e53cC7BfBD328f6D8510",
    constructorArgs: ["0x856c9e805D9cb245712d1C91bA77406933CC1472"],
    provider: "blockscout",
  },
  hre
);
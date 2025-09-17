import { ethers } from "hardhat";
import { ERC20Mintable } from "../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  const USDC_ADDRESS = "0x566809570BC556020E82AFCb6dc8e7FCa0E58A54";

  const usdc: ERC20Mintable = await ethers.getContractAt(
    "ERC20Mintable",
    USDC_ADDRESS,
    deployer
  );

  const amount = ethers.parseUnits("1000", 6);
  const tx = await usdc.mint(deployer.address, amount);
  await tx.wait();

  console.log(`Minted ${amount.toString()} USDC to ${deployer.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

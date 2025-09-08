import { ethers } from "hardhat";

async function main() {
  // Địa chỉ WETH trên Base mainnet
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
  const IWETH_ABI = [
    "function deposit() external payable",
    "function withdraw(uint256) external",
    "function balanceOf(address) external view returns (uint256)"
  ];
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  const weth = new ethers.Contract(WETH_ADDRESS, IWETH_ABI, signer);
  const amountIn = ethers.parseEther("9");
  const tx = await weth.deposit({ value: amountIn });
  await tx.wait();
  console.log(`Wrapped ${ethers.formatEther(amountIn)} ETH to WETH`);
  const bal = await weth.balanceOf(signer.address);
  console.log("WETH balance:", ethers.formatEther(bal));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
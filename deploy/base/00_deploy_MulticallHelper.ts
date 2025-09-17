import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying MulticallHelper with account:", deployer);

  const deployment = await deploy("MulticallHelper", {
    from: deployer,
    args: [], 
    log: true,
  });

  console.log("Multicall helper deployed at:", deployment.address);
//   const MulticallHelper = await ethers.getContractAt("MulticallHelper", deployment.address);
};

export default func;
func.tags = ["MulticallHelper"];

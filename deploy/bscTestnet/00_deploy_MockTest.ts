import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying MockTest with account:", deployer);

  const deployment = await deploy("MockTest", {
    from: deployer,
    args: [], 
    log: true,
  });

  console.log("MockTest deployed at:", deployment.address);
  const mockTest = await ethers.getContractAt("MockTest", deployment.address);
  const value = await mockTest.getValue();
  console.log("Initial value:", value.toString());
};

export default func;
func.tags = ["MockTest"];

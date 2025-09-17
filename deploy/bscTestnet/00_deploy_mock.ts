import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("USDC", {
    contract: "ERC20Mintable",
    from: deployer,
    args: ["USDC", "USDC", 6],
    log: true,
    autoMine: true,
  });
};
deploy.tags = ["mock"];
export default deploy;

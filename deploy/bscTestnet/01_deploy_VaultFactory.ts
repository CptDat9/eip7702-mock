// deploy/hardhat/01_deploy_VaultFactory.ts
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "hardhat";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // -------- Deploy required libraries --------
  const ERC20LogicDeployment = await deploy("ERC20Logic", { from: deployer, log: true });
  const ERC4626LogicDeployment = await deploy("ERC4626Logic", {
    from: deployer,
    log: true,
    libraries: { ERC20Logic: ERC20LogicDeployment.address },
  });
  const WithdrawLogicDeployment = await deploy("WithdrawLogic", {
    from: deployer,
    log: true,
    libraries: { ERC20Logic: ERC20LogicDeployment.address, ERC4626Logic: ERC4626LogicDeployment.address },
  });
  const UnlockSharesLogicDeployment = await deploy("UnlockSharesLogic", {
    from: deployer,
    log: true,
    libraries: { ERC20Logic: ERC20LogicDeployment.address },
  });
  const InitializeLogicDeployment = await deploy("InitializeLogic", { from: deployer, log: true });
  const ConfiguratorLogicDeployment = await deploy("ConfiguratorLogic", { from: deployer, log: true });
  const DebtLogicDeployment = await deploy("DebtLogic", {
    from: deployer,
    log: true,
    libraries: {
      ERC20Logic: ERC20LogicDeployment.address,
      ERC4626Logic: ERC4626LogicDeployment.address,
      UnlockSharesLogic: UnlockSharesLogicDeployment.address,
    },
  });
  const DepositLogicDeployment = await deploy("DepositLogic", {
    from: deployer,
    log: true,
    libraries: {
      ERC20Logic: ERC20LogicDeployment.address,
      ERC4626Logic: ERC4626LogicDeployment.address,
      DebtLogic: DebtLogicDeployment.address,
    },
  });

  // -------- Deploy Vault implementation --------
  const vaultImplementation = await deploy("Vault_Implementation", {
    contract: "Vault",
    from: deployer,
    log: true,
    libraries: {
      ERC20Logic: ERC20LogicDeployment.address,
      ERC4626Logic: ERC4626LogicDeployment.address,
      InitializeLogic: InitializeLogicDeployment.address,
      DepositLogic: DepositLogicDeployment.address,
      WithdrawLogic: WithdrawLogicDeployment.address,
      UnlockSharesLogic: UnlockSharesLogicDeployment.address,
      DebtLogic: DebtLogicDeployment.address,
      ConfiguratorLogic: ConfiguratorLogicDeployment.address,
    },
  });

  // -------- Deploy VaultFactory --------
  const vaultFactory = await deploy("VaultFactory", {
    from: deployer,
    args: [deployer, vaultImplementation.address],
    log: true,
  });

  // -------- Create Vault via VaultFactory --------
  const usdc = await deployments.get("USDC");
  const vaultFactoryInstance = await ethers.getContractAt("VaultFactory", vaultFactory.address, await ethers.getSigner(deployer));

  const tx = await vaultFactoryInstance.createVault({
    agentName: "CptDat9",
    asset: usdc.address,
    tokenName: "LP Vault",
    tokenSymbol: "LP",
    profitMaxUnlockTime: 7 * 24 * 60 * 60,
    governance: deployer,
  });

  const receipt = await tx.wait();

  // Parse event VaultCreated
  const event = receipt.logs
    .map((log) => {
      try {
        return vaultFactoryInstance.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === "VaultCreated");

  if (!event) throw new Error("Không tìm thấy event VaultCreated");
  const vaultAddress = event.args.vault;
  log(`Vault created at: ${vaultAddress}`);
};

deploy.tags = ["vaultFactory"];
deploy.dependencies = ["mock"]; // Ensure USDC is deployed first

export default deploy;

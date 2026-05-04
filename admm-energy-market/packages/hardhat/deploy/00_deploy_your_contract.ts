import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployEnergyMarket: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("EnergyMarket", {
    from: deployer,
    args: [], // 我们的构造函数目前不需要参数
    log: true,
    autoMine: true, 
  });
};

export default deployEnergyMarket;
deployEnergyMarket.tags = ["EnergyMarket"];
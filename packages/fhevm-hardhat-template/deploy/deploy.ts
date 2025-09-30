import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy FHECounter
  const deployedFHECounter = await deploy("FHECounter", {
    from: deployer,
    log: true,
  });
  console.log(`FHECounter contract: ${deployedFHECounter.address}`);

  // Deploy ConfidentialToken contracts
  const deployedTokenIn = await deploy("ConfidentialTokenIn", {
    from: deployer,
    contract: "ConfidentialTokenExample",
    args: [
      1000, // initial amount
      "Token In",
      "TIN",
      "https://example.com/tokenin"
    ],
    log: true,
  });
  console.log(`ConfidentialTokenIn contract: ${deployedTokenIn.address}`);

  const deployedTokenOut = await deploy("ConfidentialTokenOut", {
    from: deployer,
    contract: "ConfidentialTokenExample",
    args: [
      1000, // initial amount
      "Token Out",
      "TOUT",
      "https://example.com/tokenout"
    ],
    log: true,
  });
  console.log(`ConfidentialTokenOut contract: ${deployedTokenOut.address}`);

  // Deploy ConfidentialOtcEscrow
  const deployedOtcEscrow = await deploy("ConfidentialOtcEscrowWithOZ", {
    from: deployer,
    args: [deployer], // gateway address (using deployer for testing)
    log: true,
  });
  console.log(`ConfidentialOtcEscrowWithOZ contract: ${deployedOtcEscrow.address}`);

  // Deploy a general ConfidentialToken for testing
  const deployedConfidentialToken = await deploy("ConfidentialTokenExample", {
    from: deployer,
    args: [
      1000, // initial amount
      "Test Confidential Token",
      "TCT",
      "https://example.com/metadata"
    ],
    log: true,
  });
  console.log(`ConfidentialTokenExample contract: ${deployedConfidentialToken.address}`);

};
export default func;
func.id = "deploy_all_contracts"; // id required to prevent reexecution
func.tags = ["FHECounter", "ConfidentialTokenIn", "ConfidentialTokenOut", "ConfidentialOtcEscrowWithOZ", "ConfidentialTokenExample"];

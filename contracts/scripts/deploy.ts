import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

const getEnvKeyForNetwork = (networkName: string): string => {
  if (networkName === "amoy") {
    return "VITE_AMOY_VOTING_CONTRACT_ADDRESS";
  }

  return "VITE_SEPOLIA_VOTING_CONTRACT_ADDRESS";
};

const getLabelForNetwork = (networkName: string): string => {
  if (networkName === "amoy") {
    return "Polygon Amoy";
  }

  return "Ethereum Sepolia";
};

async function main() {
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY in ../.env. Add a funded deployer private key before deploying.");
  }

  const factory = await ethers.getContractFactory("VotingFactory");
  // Deploy with the deployer as treasury and a zero fee so testnet usage stays frictionless.
  const contract = await factory.deploy(deployer.address, 0);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  const envKey = getEnvKeyForNetwork(network.name);
  const networkLabel = getLabelForNetwork(network.name);

  const envPath = path.resolve(__dirname, "../../.env");
  const envContents = fs.readFileSync(envPath, "utf8");
  let nextEnvContents = envContents.match(new RegExp(`^${envKey}=.*`, "m"))
    ? envContents.replace(new RegExp(`^${envKey}=.*`, "m"), `${envKey}=${contractAddress}`)
    : `${envContents.trimEnd()}\n${envKey}=${contractAddress}\n`;

  if (network.name === "sepolia") {
    nextEnvContents = nextEnvContents.match(/^VITE_VOTING_CONTRACT_ADDRESS=.*/m)
      ? nextEnvContents.replace(/^VITE_VOTING_CONTRACT_ADDRESS=.*/m, `VITE_VOTING_CONTRACT_ADDRESS=${contractAddress}`)
      : `${nextEnvContents.trimEnd()}\nVITE_VOTING_CONTRACT_ADDRESS=${contractAddress}\n`;
  }

  fs.writeFileSync(envPath, nextEnvContents);

  console.log(`VotingFactory deployed to ${networkLabel}:`, contractAddress);
  // The deployer remains the contract owner for treasury and fee management.
  console.log("Owner:", deployer.address);
  console.log(`Updated .env with ${envKey}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { backendConfig } from "../config.js";
import { HttpError } from "../errors.js";

let cachedProvider: JsonRpcProvider | null = null;
let cachedRelayer: Wallet | null = null;

const votingFactoryAbi = [
  "function getEvent(uint256 eventId) view returns ((uint256 id,string title,string description,uint8 mode,address creator,uint256 startTime,uint256 endTime,bool isActive,bool isPublic,uint256 proposalCount,uint256 allowedVoterCount))",
  "function getEventProposals(uint256 eventId) view returns ((uint256 id,uint256 eventId,string title,string description,string[] options,uint256[] voteCounts,bool exists)[])",
  "function canVoteInEvent(uint256 eventId, address voter) view returns (bool)",
  "function authorizeVoter(uint256 eventId, address voter)",
] as const;

const ensureReadProvider = (): JsonRpcProvider => {
  if (!backendConfig.sepoliaRpcUrl) {
    throw new HttpError(503, "Sepolia RPC is not configured. Set SEPOLIA_RPC_URL or VITE_SEPOLIA_RPC_URL.");
  }
  if (!cachedProvider) {
    cachedProvider = new JsonRpcProvider(backendConfig.sepoliaRpcUrl);
  }
  return cachedProvider;
};

const ensureRelayerWallet = (): Wallet => {
  const provider = ensureReadProvider();
  if (!backendConfig.relayerPrivateKey) {
    throw new HttpError(
      503,
      "Relayer wallet is not configured. Set BACKEND_RELAYER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY to authorize private voters on-chain.",
    );
  }
  if (!cachedRelayer) {
    try {
      cachedRelayer = new Wallet(backendConfig.relayerPrivateKey, provider);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Invalid relayer private key.";
      throw new HttpError(503, `Relayer wallet could not be loaded: ${detail}`);
    }
  }
  return cachedRelayer;
};

export interface OnChainEventSnapshot {
  title: string;
  description: string;
  creator: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  isPublic: boolean;
  proposalCount: number;
  allowedVoterCount: number;
}

export interface OnChainProposalSnapshot {
  id: number;
  eventId: number;
  title: string;
  description: string;
  options: string[];
  voteCounts: number[];
}

const getReadContract = (contractAddress: string) => new Contract(contractAddress, votingFactoryAbi, ensureReadProvider());
const getWriteContract = (contractAddress: string) => new Contract(contractAddress, votingFactoryAbi, ensureRelayerWallet());

const mapContractCallError = (error: unknown, fallbackMessage: string): never => {
  if (error instanceof HttpError) {
    throw error;
  }
  throw new HttpError(400, error instanceof Error ? error.message : fallbackMessage);
};

export const getSepoliaEventSnapshot = async (contractAddress: string, eventId: number): Promise<OnChainEventSnapshot> => {
  try {
    const contract = getReadContract(contractAddress);
    const event = (await contract["getEvent(uint256)"](BigInt(eventId))) as {
      title: string;
      description: string;
      creator: string;
      startTime: bigint;
      endTime: bigint;
      isActive: boolean;
      isPublic: boolean;
      proposalCount: bigint;
      allowedVoterCount: bigint;
    };

    return {
      title: event.title,
      description: event.description,
      creator: event.creator,
      startTime: Number(event.startTime),
      endTime: Number(event.endTime),
      isActive: event.isActive,
      isPublic: event.isPublic,
      proposalCount: Number(event.proposalCount),
      allowedVoterCount: Number(event.allowedVoterCount),
    };
  } catch (error) {
    throw mapContractCallError(error, "Unable to read the event from the Sepolia contract.");
  }
};

export const getSepoliaEventProposals = async (contractAddress: string, eventId: number): Promise<OnChainProposalSnapshot[]> => {
  try {
    const contract = getReadContract(contractAddress);
    const proposals = (await contract.getEventProposals(BigInt(eventId))) as Array<{
      id: bigint;
      eventId: bigint;
      title: string;
      description: string;
      options: string[];
      voteCounts: bigint[];
      exists: boolean;
    }>;

    return proposals.map((proposal) => ({
      id: Number(proposal.id),
      eventId: Number(proposal.eventId),
      title: proposal.title,
      description: proposal.description,
      options: proposal.options,
      voteCounts: proposal.voteCounts.map((count) => Number(count)),
    }));
  } catch (error) {
    throw mapContractCallError(error, "Unable to read the event proposals from the Sepolia contract.");
  }
};

export const authorizePrivateEventVoter = async (contractAddress: string, eventId: number, voterAddress: string): Promise<string> => {
  try {
    const contract = getWriteContract(contractAddress);
    const tx = await contract.authorizeVoter(BigInt(eventId), voterAddress);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  } catch (error) {
    throw mapContractCallError(error, "Unable to authorize the wallet on the Sepolia contract.");
  }
};

export const canWalletVoteInSepoliaEvent = async (contractAddress: string, eventId: number, voterAddress: string): Promise<boolean> => {
  try {
    const contract = getReadContract(contractAddress);
    return (await contract.canVoteInEvent(BigInt(eventId), voterAddress)) as boolean;
  } catch (error) {
    throw mapContractCallError(error, "Unable to verify whether the wallet can vote on the Sepolia contract.");
  }
};

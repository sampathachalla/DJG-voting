import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { backendConfig } from "../config.js";
import { HttpError } from "../errors.js";

const provider = new JsonRpcProvider(backendConfig.sepoliaRpcUrl);
const relayer = new Wallet(backendConfig.relayerPrivateKey, provider);

const votingFactoryAbi = [
  "function getEvent(uint256 eventId) view returns ((uint256 id,string title,string description,uint8 mode,address creator,uint256 startTime,uint256 endTime,bool isActive,bool isPublic,uint256 proposalCount,uint256 allowedVoterCount))",
  "function getEventProposals(uint256 eventId) view returns ((uint256 id,uint256 eventId,string title,string description,string[] options,uint256[] voteCounts)[])",
  "function authorizeVoter(uint256 eventId, address voter)",
] as const;

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

const getReadContract = (contractAddress: string) => new Contract(contractAddress, votingFactoryAbi, provider);
const getWriteContract = (contractAddress: string) => new Contract(contractAddress, votingFactoryAbi, relayer);

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
    throw new HttpError(400, error instanceof Error ? error.message : "Unable to read the event from the Sepolia contract.");
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
    throw new HttpError(400, error instanceof Error ? error.message : "Unable to read the event proposals from the Sepolia contract.");
  }
};

export const authorizePrivateEventVoter = async (contractAddress: string, eventId: number, voterAddress: string): Promise<string> => {
  try {
    const contract = getWriteContract(contractAddress);
    const tx = await contract.authorizeVoter(BigInt(eventId), voterAddress);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Unable to authorize the wallet on the Sepolia contract.");
  }
};

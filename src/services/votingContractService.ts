import { Contract, ethers } from "ethers";
import { getContractConfig, hasVotingContractAddress } from "../contracts/config";
import { votingFactoryAbi } from "../contracts/votingFactoryAbi";
import { getRpcProvider } from "./sepoliaService";
import type { AppTestnet, CreateEventInput, VotingEventMode, VotingEventSummary, VotingProposal, VoteRecord } from "../types/voting";

export interface CreateVotingEventResult {
  txHash: string;
  eventId: number | null;
}

const modeValues: Record<VotingEventMode, number> = {
  SingleBallot: 0,
  MultiElection: 1,
  ProposalBased: 2,
};

const modeNames: Record<number, VotingEventMode> = {
  0: "SingleBallot",
  1: "MultiElection",
  2: "ProposalBased",
};

const getContractAddress = (network: AppTestnet): string => {
  const { address } = getContractConfig(network);

  if (!address) {
    throw new Error(`Missing contract address for ${getContractConfig(network).networkLabel}.`);
  }

  return address;
};

const getReadContract = (network: AppTestnet): Contract => {
  return new Contract(getContractAddress(network), votingFactoryAbi, getRpcProvider(network));
};

const getWriteContract = (runner: ethers.ContractRunner, network: AppTestnet): Contract => {
  return new Contract(getContractAddress(network), votingFactoryAbi, runner);
};

const mapEvent = (event: {
  id: bigint;
  title: string;
  description: string;
  mode: bigint | number;
  creator: string;
  startTime: bigint;
  endTime: bigint;
  isActive: boolean;
  isPublic: boolean;
  proposalCount: bigint;
  allowedVoterCount: bigint;
}): VotingEventSummary => ({
  id: Number(event.id),
  title: event.title,
  description: event.description,
  mode: modeNames[Number(event.mode)] ?? "SingleBallot",
  creator: event.creator,
  startTime: Number(event.startTime),
  endTime: Number(event.endTime),
  isActive: event.isActive,
  isPublic: event.isPublic,
  proposalCount: Number(event.proposalCount),
  allowedVoterCount: Number(event.allowedVoterCount),
});

const mapProposal = (proposal: {
  id: bigint;
  eventId: bigint;
  title: string;
  description: string;
  options: string[];
  voteCounts: bigint[];
}): VotingProposal => ({
  id: Number(proposal.id),
  eventId: Number(proposal.eventId),
  title: proposal.title,
  description: proposal.description,
  options: proposal.options,
  voteCounts: proposal.voteCounts.map((count) => count.toString()),
});

export const getContractOwner = async (network: AppTestnet): Promise<string> => {
  if (!hasVotingContractAddress(network)) {
    return "";
  }

  const contract = getReadContract(network);
  return (await contract.owner()) as string;
};

export const getTreasuryAddress = async (network: AppTestnet): Promise<string> => {
  if (!hasVotingContractAddress(network)) {
    return "";
  }

  const contract = getReadContract(network);
  return (await contract.treasury()) as string;
};

export const getEventCreationFee = async (network: AppTestnet): Promise<string> => {
  if (!hasVotingContractAddress(network)) {
    return "0";
  }

  const contract = getReadContract(network);
  const fee = (await contract.eventCreationFeeWei()) as bigint;
  return ethers.formatEther(fee);
};

export const getEvents = async (network: AppTestnet): Promise<VotingEventSummary[]> => {
  if (!hasVotingContractAddress(network)) {
    return [];
  }

  const contract = getReadContract(network);
  const events = (await contract.getEvents()) as Array<{
    id: bigint;
    title: string;
    description: string;
    mode: number;
    creator: string;
    startTime: bigint;
    endTime: bigint;
    isActive: boolean;
    isPublic: boolean;
    proposalCount: bigint;
    allowedVoterCount: bigint;
  }>;

  return events.map(mapEvent);
};

export const getEvent = async (eventId: number, network: AppTestnet): Promise<VotingEventSummary> => {
  if (!hasVotingContractAddress(network)) {
    throw new Error("No voting contract has been configured yet.");
  }

  const contract = getReadContract(network);
  const event = await contract["getEvent(uint256)"](eventId);
  return mapEvent(event);
};

export const getEventProposals = async (eventId: number, network: AppTestnet): Promise<VotingProposal[]> => {
  if (!hasVotingContractAddress(network)) {
    return [];
  }

  const contract = getReadContract(network);
  const proposals = (await contract.getEventProposals(eventId)) as Array<{
    id: bigint;
    eventId: bigint;
    title: string;
    description: string;
    options: string[];
    voteCounts: bigint[];
  }>;

  return proposals.map(mapProposal);
};

export const canWalletVoteInEvent = async (eventId: number, walletAddress: string, network: AppTestnet): Promise<boolean> => {
  if (!hasVotingContractAddress(network)) {
    return false;
  }

  const contract = getReadContract(network);
  return (await contract.canVoteInEvent(eventId, walletAddress)) as boolean;
};

export const getAllowedVoters = async (eventId: number, network: AppTestnet): Promise<string[]> => {
  if (!hasVotingContractAddress(network)) {
    return [];
  }

  const contract = getReadContract(network);
  return (await contract.getAllowedVoters(eventId)) as string[];
};

export const getEventVoteCount = async (eventId: number, network: AppTestnet): Promise<number> => {
  if (!hasVotingContractAddress(network)) {
    return 0;
  }

  const contract = getReadContract(network);
  const count = (await contract.getEventVoteCount(eventId)) as bigint;
  return Number(count);
};

export const getVoteRecord = async (
  eventId: number,
  proposalId: number,
  walletAddress: string,
  network: AppTestnet,
): Promise<VoteRecord> => {
  if (!hasVotingContractAddress(network)) {
    return { hasVoted: false };
  }

  const contract = getReadContract(network);
  const voted = (await contract.getVoteRecord(eventId, proposalId, walletAddress)) as boolean;

  return { hasVoted: voted };
};

export const createVotingEvent = async (
  runner: ethers.ContractRunner,
  input: CreateEventInput,
  network: AppTestnet,
): Promise<CreateVotingEventResult> => {
  if (!hasVotingContractAddress(network)) {
    throw new Error(`Deploy the voting contract for ${getContractConfig(network).networkLabel} before creating an event.`);
  }

  const contract = getWriteContract(runner, network);
  const feeWei = await contract.eventCreationFeeWei();
  const tx = await contract.createEvent(
    input.proposals.map((proposal) => ({
      title: proposal.title,
      description: proposal.description,
      options: proposal.options,
    })),
    input.title,
    input.description,
    modeValues[input.mode],
    input.startTime,
    input.endTime,
    input.isPublic,
    input.allowedVoters,
    { value: feeWei },
  );

  const receipt = await tx.wait();
  const eventId =
    receipt?.logs
      ?.map((log: ethers.Log | ethers.EventLog) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: ethers.LogDescription | null) => parsed?.name === "EventCreated")
      ?.args?.eventId ?? null;

  return {
    txHash: receipt?.hash ?? tx.hash,
    eventId: eventId !== null ? Number(eventId) : null,
  };
};

export const deleteVotingEvent = async (runner: ethers.ContractRunner, eventId: number, network: AppTestnet): Promise<string> => {
  if (!hasVotingContractAddress(network)) {
    throw new Error(`Deploy the voting contract for ${getContractConfig(network).networkLabel} before deleting an event.`);
  }

  const contract = getWriteContract(runner, network);
  const tx = await contract.deleteEvent(eventId);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
};

export const castVote = async (
  runner: ethers.ContractRunner,
  eventId: number,
  proposalId: number,
  optionIndex: number,
  network: AppTestnet,
): Promise<string> => {
  if (!hasVotingContractAddress(network)) {
    throw new Error(`Deploy the voting contract for ${getContractConfig(network).networkLabel} before casting a vote.`);
  }

  const contract = getWriteContract(runner, network);
  const tx = await contract.castVote(eventId, proposalId, optionIndex);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
};

export const updateEventCreationFee = async (runner: ethers.ContractRunner, feeEth: string, network: AppTestnet): Promise<string> => {
  if (!hasVotingContractAddress(network)) {
    throw new Error(`Deploy the voting contract for ${getContractConfig(network).networkLabel} before using admin controls.`);
  }

  const contract = getWriteContract(runner, network);
  const tx = await contract.setEventCreationFee(ethers.parseEther(feeEth));
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
};

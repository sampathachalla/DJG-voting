import type { JsonRpcSigner } from "ethers";

export type WalletSource = "internal" | "metamask";
export type AppTestnet = "sepolia" | "amoy";

export interface LocalAccountRecord {
  email: string;
  walletAddress: string;
  encryptedPrivateKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletSession {
  email?: string;
  walletAddress: string;
  walletSource: WalletSource;
  activeNetwork?: AppTestnet;
  sessionPrivateKey?: string;
}

export type VotingEventMode = "SingleBallot" | "MultiElection" | "ProposalBased";

export interface VotingEventSummary {
  id: number;
  title: string;
  description: string;
  mode: VotingEventMode;
  creator: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  isPublic: boolean;
  proposalCount: number;
  allowedVoterCount: number;
}

export interface VotingProposal {
  id: number;
  eventId: number;
  title: string;
  description: string;
  options: string[];
  voteCounts: string[];
}

export interface VoteRecord {
  hasVoted: boolean;
  optionIndex: number | null;
}

export interface CreateProposalInput {
  title: string;
  description: string;
  options: string[];
}

export interface CreateEventInput {
  title: string;
  description: string;
  mode: VotingEventMode;
  startTime: number;
  endTime: number;
  isPublic: boolean;
  allowedVoters: string[];
  proposals: CreateProposalInput[];
}

export interface ContractConfig {
  network: AppTestnet;
  networkLabel: string;
  address: string;
  chainId: number;
  nativeTokenSymbol: string;
  explorerBaseUrl: string;
}

export interface WalletState {
  walletAddress: string | null;
  walletSource: WalletSource | null;
  email: string | null;
  balance: string | null;
  activeNetwork: AppTestnet;
  isCorrectNetwork: boolean;
  signer: JsonRpcSigner | null;
}

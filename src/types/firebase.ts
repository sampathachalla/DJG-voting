export interface FirebaseUserProfile {
  email?: string | null;
  walletAddress: string;
  walletSource?: "internal" | "metamask";
  createdAt?: string;
  updatedAt?: string;
}

export interface FirebaseContractRecord {
  network: string;
  networkLabel: string;
  contractAddress: string;
  status: "active" | "deprecated";
  createdAt?: string;
  updatedAt?: string;
}

export interface FirebaseEventRecord {
  network: string;
  networkLabel: string;
  contractAddress: string;
  eventId: number;
  title: string;
  description: string;
  creatorWalletAddress: string;
  creatorEmail?: string;
  mode: string;
  isPublic: boolean;
  allowedVoterCount: number;
  proposalCount: number;
  startTime: number;
  endTime: number;
  transactionHash: string;
  status: "active" | "upcoming" | "ended" | "canceled";
  createdAt?: string;
  updatedAt?: string;
}

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

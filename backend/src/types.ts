export type SupportedNetwork = "sepolia";

export interface PrivateEventRecord {
  id: string;
  network: SupportedNetwork;
  contractAddress: string;
  eventId: number;
  organizerWallet: string;
  title: string;
  description: string;
  startsAt: number;
  endsAt: number;
  isActive: boolean;
  isPublic: boolean;
  proposalCount: number;
  inviteCount: number;
  usedInviteCount: number;
  registeredWalletCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InviteRecord {
  id: string;
  eventKey: string;
  tokenHash: string;
  issuedByWallet: string;
  expiresAt: string | null;
  reservedAt: string | null;
  reservedByWallet: string | null;
  usedAt: string | null;
  usedByWallet: string | null;
  authorizationTxHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationRecord {
  id: string;
  eventKey: string;
  walletAddress: string;
  inviteTokenHash: string;
  registeredAt: string;
  authorizationStatus: "pending" | "authorized";
  authorizationTxHash: string | null;
  updatedAt: string;
}

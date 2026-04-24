import { ethers } from "ethers";

export interface PrivateVotingEventSummary {
  id: string;
  network: "sepolia";
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

export interface PrivateVotingResults {
  event: PrivateVotingEventSummary;
  tallies: Record<string, number>;
  totalVotes: number;
}

const getApiBaseUrl = (): string =>
  ((import.meta.env.VITE_PRIVATE_VOTING_API_URL as string | undefined) ?? "http://localhost:8080/api").replace(/\/$/, "");

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Private voting backend request failed.");
  }

  return payload as T;
};

export const createPrivateInviteBatch = async (payload: {
  eventId: number;
  contractAddress: string;
  organizerWallet: string;
  inviteCount: number;
  expiresAt?: string | null;
  signer: ethers.Signer;
}): Promise<{ eventKey: string; inviteTokens: string[]; expiresAt: string | null }> => {
  const signature = await payload.signer.signMessage(
    [
      "DoJaGa private voting",
      "Action: create-invites",
      `Event: ${payload.eventId}`,
      `Contract: ${payload.contractAddress}`,
      `Organizer: ${payload.organizerWallet}`,
      `Invite count: ${payload.inviteCount}`,
      `Expires at: ${payload.expiresAt ?? "none"}`,
    ].join("\n"),
  );

  return requestJson("/private-events/invites", {
    method: "POST",
    body: JSON.stringify({
      eventId: payload.eventId,
      contractAddress: payload.contractAddress,
      organizerWallet: payload.organizerWallet,
      inviteCount: payload.inviteCount,
      expiresAt: payload.expiresAt ?? null,
      signature,
    }),
  });
};

export const registerWalletWithInviteToken = async (payload: {
  eventId: number;
  contractAddress: string;
  walletAddress: string;
  inviteToken: string;
  signer: ethers.Signer;
}): Promise<{ eventKey: string; authorizationTxHash: string; alreadyRegistered: boolean }> => {
  const signature = await payload.signer.signMessage(
    [
      "DoJaGa private voting",
      "Action: register-wallet",
      `Event: ${payload.eventId}`,
      `Contract: ${payload.contractAddress}`,
      `Wallet: ${payload.walletAddress}`,
      `Invite token: ${payload.inviteToken}`,
    ].join("\n"),
  );

  return requestJson("/private-events/register", {
    method: "POST",
    body: JSON.stringify({
      eventId: payload.eventId,
      contractAddress: payload.contractAddress,
      walletAddress: payload.walletAddress,
      inviteToken: payload.inviteToken,
      signature,
    }),
  });
};

export const submitPrivateAnonymousVote = async (payload: {
  eventId: number;
  contractAddress: string;
  voteToken: string;
  proposalId: number;
  optionIndex: number;
}): Promise<{ accepted: true; eventKey: string }> =>
  requestJson("/private-events/vote", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getPrivateEventSummary = async (eventId: number, contractAddress: string): Promise<PrivateVotingEventSummary> =>
  requestJson(`/private-events/${eventId}?contractAddress=${encodeURIComponent(contractAddress)}`);

export const getPrivateEventResults = async (eventId: number, contractAddress: string): Promise<PrivateVotingResults> =>
  requestJson(`/private-events/${eventId}/results?contractAddress=${encodeURIComponent(contractAddress)}`);

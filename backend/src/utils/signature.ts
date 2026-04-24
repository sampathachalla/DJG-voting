import { ethers } from "ethers";

export const buildInviteCreationMessage = (payload: {
  eventId: number;
  contractAddress: string;
  organizerWallet: string;
  inviteCount: number;
  expiresAt?: string | null;
}): string =>
  [
    "DoJaGa private voting",
    "Action: create-invites",
    `Event: ${payload.eventId}`,
    `Contract: ${payload.contractAddress}`,
    `Organizer: ${payload.organizerWallet}`,
    `Invite count: ${payload.inviteCount}`,
    `Expires at: ${payload.expiresAt ?? "none"}`,
  ].join("\n");

export const buildRegistrationMessage = (payload: {
  eventId: number;
  contractAddress: string;
  walletAddress: string;
  inviteToken: string;
}): string =>
  [
    "DoJaGa private voting",
    "Action: register-wallet",
    `Event: ${payload.eventId}`,
    `Contract: ${payload.contractAddress}`,
    `Wallet: ${payload.walletAddress}`,
    `Invite token: ${payload.inviteToken}`,
  ].join("\n");

export const assertSignedByWallet = (message: string, signature: string, walletAddress: string): void => {
  const recovered = ethers.verifyMessage(message, signature);

  if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error("Signature does not match the provided wallet address.");
  }
};

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

/** When unset, use same-origin `/api` (Vite dev server proxies to the backend). */
const DEFAULT_PRIVATE_VOTING_API_BASE = "/api";

const getApiBaseUrl = (): string => {
  const raw = (import.meta.env.VITE_PRIVATE_VOTING_API_URL as string | undefined)?.trim();
  const base = raw && raw.length > 0 ? raw : DEFAULT_PRIVATE_VOTING_API_BASE;
  return base.replace(/\/$/, "");
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch (cause) {
    const isNetwork =
      cause instanceof TypeError ||
      (cause instanceof Error && (cause.message === "Failed to fetch" || cause.name === "TypeError"));
    if (isNetwork) {
      const originHint =
        typeof window !== "undefined" ? window.location.origin : "your app origin";
      throw new Error(
        `Cannot reach the private voting API (${url}). From the repo root run npm run backend:dev ( listens on port 8081). ` +
          `With npm run dev, leave VITE_PRIVATE_VOTING_API_URL unset so requests use same-origin ${DEFAULT_PRIVATE_VOTING_API_BASE} (Vite proxies to the backend). ` +
          `If you call the API from another origin, set VITE_PRIVATE_VOTING_API_URL to the full base including /api and add that origin to BACKEND_ALLOWED_ORIGINS (localhost and 127.0.0.1 any port are allowed by default). Current app origin: ${originHint}.`,
      );
    }
    throw cause;
  }

  const rawBody = await response.text();
  let payload: unknown = null;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const fromJson = ((): string | null => {
      if (!payload || typeof payload !== "object") {
        return null;
      }
      const obj = payload as { error?: unknown; message?: unknown };
      const stringifyUnknown = (value: unknown): string => {
        if (typeof value === "string") {
          return value;
        }
        if (typeof value === "number" || typeof value === "boolean") {
          return String(value);
        }
        if (value == null) {
          return "";
        }
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      };
      if (obj.error != null) {
        const text = stringifyUnknown(obj.error).trim();
        if (text.length > 0) {
          return text.length > 800 ? `${text.slice(0, 800)}…` : text;
        }
      }
      if (typeof obj.message === "string" && obj.message.length > 0) {
        return obj.message;
      }
      return null;
    })();
    const trimmed = rawBody.trim();
    const fallbackDetail =
      fromJson ||
      (trimmed && trimmed.length <= 800 && !trimmed.startsWith("<") ? trimmed : "") ||
      (trimmed.startsWith("<") ? `Non-JSON response (${response.status}). Is the API proxy/backend running?` : "");
    throw new Error(
      fallbackDetail || `Private voting API request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ""}).`,
    );
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
}): Promise<{ eventKey: string; authorizationTxHash: string | null; alreadyRegistered: boolean }> => {
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

export const getPrivateEventSummary = async (eventId: number, contractAddress: string): Promise<PrivateVotingEventSummary> =>
  requestJson(`/private-events/${eventId}?contractAddress=${encodeURIComponent(contractAddress)}`);

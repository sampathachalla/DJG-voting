import { createHash, randomBytes } from "node:crypto";

export const generateOpaqueToken = (): string => randomBytes(24).toString("base64url");

export const hashOpaqueToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export const nowIso = (): string => new Date().toISOString();

export const normalizeAddress = (value: string): string => value.trim().toLowerCase();

export const buildEventKey = (contractAddress: string, eventId: number): string =>
  `sepolia_${normalizeAddress(contractAddress)}_${eventId}`;

import { HttpError } from "../errors.js";
import { readPrivateVotingStore, runPrivateVotingStoreTransaction } from "../privateVotingStore.js";
import type { InviteRecord, PrivateEventRecord, RegistrationRecord } from "../types.js";
import { buildEventKey, generateOpaqueToken, hashOpaqueToken, normalizeAddress, nowIso } from "../utils/crypto.js";
import { assertSignedByWallet, buildInviteCreationMessage, buildRegistrationMessage } from "../utils/signature.js";
import {
  authorizePrivateEventVoter,
  canWalletVoteInSepoliaEvent,
  getSepoliaEventProposals,
  getSepoliaEventSnapshot,
  type OnChainEventSnapshot,
} from "./sepoliaContractService.js";

const collections = {
  events: "privateVotingEvents",
  invites: "privateVotingInvites",
  registrations: "privateVotingRegistrations",
} as const;

const eventKeyForStore = (eventKey: string) => `${collections.events}:${eventKey}`;
const inviteKeyForStore = (eventKey: string, tokenHash: string) => `${collections.invites}:${eventKey}_${tokenHash}`;
const registrationKeyForStore = (eventKey: string, walletAddress: string) =>
  `${collections.registrations}:${eventKey}_${normalizeAddress(walletAddress)}`;

export interface CreatePrivateInvitesInput {
  eventId: number;
  contractAddress: string;
  organizerWallet: string;
  inviteCount: number;
  expiresAt?: string | null;
  signature: string;
}

export interface RegisterWalletInput {
  eventId: number;
  contractAddress: string;
  walletAddress: string;
  inviteToken: string;
  signature: string;
}

const assertPrivateOnChainEventOwnership = async (contractAddress: string, eventId: number, organizerWallet: string) => {
  const snapshot = await getSepoliaEventSnapshot(contractAddress, eventId);

  if (snapshot.creator.toLowerCase() !== organizerWallet.toLowerCase()) {
    throw new HttpError(403, "Only the event creator can manage invite tokens for this event.");
  }

  if (snapshot.isPublic) {
    throw new HttpError(400, "Invite-token registration is only available for restricted Sepolia events.");
  }

  return snapshot;
};

const buildPrivateEventRecord = (
  contractAddress: string,
  eventId: number,
  eventKey: string,
  onChainEvent: OnChainEventSnapshot,
  organizerWallet: string,
  existing: Partial<PrivateEventRecord> | null,
  updatedAt: string,
): PrivateEventRecord => ({
  id: eventKey,
  network: "sepolia",
  contractAddress: normalizeAddress(contractAddress),
  eventId,
  organizerWallet: normalizeAddress(organizerWallet),
  title: onChainEvent.title,
  description: onChainEvent.description,
  startsAt: onChainEvent.startTime,
  endsAt: onChainEvent.endTime,
  isActive: onChainEvent.isActive,
  isPublic: false,
  proposalCount: onChainEvent.proposalCount,
  inviteCount: existing?.inviteCount ?? 0,
  usedInviteCount: existing?.usedInviteCount ?? 0,
  registeredWalletCount: existing?.registeredWalletCount ?? 0,
  createdAt: existing?.createdAt ?? updatedAt,
  updatedAt,
});

export const createPrivateInvites = async (input: CreatePrivateInvitesInput) => {
  if (input.inviteCount < 1 || input.inviteCount > 500) {
    throw new HttpError(400, "Invite count must be between 1 and 500.");
  }

  const message = buildInviteCreationMessage(input);
  assertSignedByWallet(message, input.signature, input.organizerWallet);

  const onChainEvent = await assertPrivateOnChainEventOwnership(input.contractAddress, input.eventId, input.organizerWallet);
  const eventKey = buildEventKey(input.contractAddress, input.eventId);
  const issuedAt = nowIso();

  const inviteTokens = Array.from({ length: input.inviteCount }, () => generateOpaqueToken());

  await runPrivateVotingStoreTransaction(async (state) => {
    const existing = state.events[eventKeyForStore(eventKey)] ?? null;

    const eventRecord = buildPrivateEventRecord(input.contractAddress, input.eventId, eventKey, onChainEvent, input.organizerWallet, existing, issuedAt);
    eventRecord.inviteCount = (existing?.inviteCount ?? 0) + input.inviteCount;
    state.events[eventKeyForStore(eventKey)] = eventRecord;

    for (const inviteToken of inviteTokens) {
      const tokenHash = hashOpaqueToken(inviteToken);
      const record: InviteRecord = {
        id: `${eventKey}_${tokenHash}`,
        eventKey,
        tokenHash,
        issuedByWallet: normalizeAddress(input.organizerWallet),
        expiresAt: input.expiresAt ?? null,
        reservedAt: null,
        reservedByWallet: null,
        usedAt: null,
        usedByWallet: null,
        authorizationTxHash: null,
        createdAt: issuedAt,
        updatedAt: issuedAt,
      };

      state.invites[inviteKeyForStore(eventKey, tokenHash)] = record;
    }
  });

  return {
    eventKey,
    inviteTokens,
    expiresAt: input.expiresAt ?? null,
  };
};

export const registerWalletForPrivateEvent = async (input: RegisterWalletInput) => {
  const eventKey = buildEventKey(input.contractAddress, input.eventId);
  const inviteTokenHash = hashOpaqueToken(input.inviteToken);
  const walletAddress = normalizeAddress(input.walletAddress);
  const registeredAt = nowIso();

  const message = buildRegistrationMessage(input);
  assertSignedByWallet(message, input.signature, input.walletAddress);

  const [onChainEvent, store] = await Promise.all([
    getSepoliaEventSnapshot(input.contractAddress, input.eventId),
    readPrivateVotingStore(),
  ]);
  const existingEvent = store.events[eventKeyForStore(eventKey)] ?? null;
  const existingInvite = store.invites[inviteKeyForStore(eventKey, inviteTokenHash)] ?? null;
  const existingRegistration = store.registrations[registrationKeyForStore(eventKey, walletAddress)] ?? null;

  if (onChainEvent.isPublic) {
    throw new HttpError(400, "This event is public and does not require invite-token registration.");
  }

  if (!existingEvent) {
    throw new HttpError(404, "This private event has not been prepared in the backend yet. Create invite tokens first.");
  }

  if (!existingInvite) {
    throw new HttpError(404, "Invalid invite token.");
  }

  if (existingRegistration) {
    if (existingRegistration.authorizationStatus === "authorized") {
      return {
        eventKey,
        authorizationTxHash: existingRegistration.authorizationTxHash,
        alreadyRegistered: true,
      };
    }
  }

  if (existingInvite.usedAt) {
    throw new HttpError(409, "This invite token has already been used.");
  }

  if (existingInvite.expiresAt && Date.parse(existingInvite.expiresAt) < Date.now()) {
    throw new HttpError(410, "This invite token has expired.");
  }

  const proposals = await getSepoliaEventProposals(input.contractAddress, input.eventId);
  if (proposals.length !== onChainEvent.proposalCount) {
    throw new HttpError(409, "The event proposals are not available on-chain yet. Try again in a moment.");
  }

  await runPrivateVotingStoreTransaction(async (state) => {
    const eventRecord = state.events[eventKeyForStore(eventKey)];
    const currentInvite = state.invites[inviteKeyForStore(eventKey, inviteTokenHash)];
    const currentRegistration = state.registrations[registrationKeyForStore(eventKey, walletAddress)];

    if (!eventRecord) {
      throw new HttpError(404, "This private event has not been prepared in the backend yet. Create invite tokens first.");
    }

    if (!currentInvite) {
      throw new HttpError(404, "Invalid invite token.");
    }

    if (currentRegistration?.authorizationStatus === "authorized") {
      return;
    }

    if (currentInvite.usedAt) {
      throw new HttpError(409, "This invite token has already been used.");
    }

    if (currentInvite.reservedByWallet && currentInvite.reservedByWallet !== walletAddress) {
      throw new HttpError(409, "This invite token is already being used by another wallet registration.");
    }

    const registration: RegistrationRecord = {
      id: `${eventKey}_${walletAddress}`,
      eventKey,
      walletAddress,
      inviteTokenHash,
      registeredAt,
      authorizationStatus: "pending",
      authorizationTxHash: null,
      updatedAt: registeredAt,
    };

    state.registrations[registrationKeyForStore(eventKey, walletAddress)] = registration;
    state.invites[inviteKeyForStore(eventKey, inviteTokenHash)] = {
      ...currentInvite,
      reservedAt: registeredAt,
      reservedByWallet: walletAddress,
      updatedAt: registeredAt,
    };
  });

  const alreadyAuthorizedOnChain = await canWalletVoteInSepoliaEvent(input.contractAddress, input.eventId, walletAddress);
  const authorizationTxHash = alreadyAuthorizedOnChain
    ? existingRegistration?.authorizationTxHash ?? null
    : await authorizePrivateEventVoter(input.contractAddress, input.eventId, walletAddress);

  await runPrivateVotingStoreTransaction(async (state) => {
    const eventRecord = state.events[eventKeyForStore(eventKey)];
    const currentInvite = state.invites[inviteKeyForStore(eventKey, inviteTokenHash)];
    const currentRegistration = state.registrations[registrationKeyForStore(eventKey, walletAddress)];

    if (!eventRecord || !currentInvite || !currentRegistration) {
      throw new HttpError(409, "Private registration state is incomplete. Retry the registration.");
    }

    if (currentRegistration.authorizationStatus === "authorized") {
      return;
    }

    if (currentInvite.reservedByWallet && currentInvite.reservedByWallet !== walletAddress) {
      throw new HttpError(409, "This invite token is already reserved for another wallet.");
    }

    state.registrations[registrationKeyForStore(eventKey, walletAddress)] = {
      ...currentRegistration,
      authorizationStatus: "authorized",
      authorizationTxHash,
      updatedAt: registeredAt,
    };

    state.invites[inviteKeyForStore(eventKey, inviteTokenHash)] = {
      ...currentInvite,
      reservedAt: null,
      reservedByWallet: null,
      usedAt: registeredAt,
      usedByWallet: walletAddress,
      authorizationTxHash,
      updatedAt: registeredAt,
    };

    state.events[eventKeyForStore(eventKey)] = {
      ...eventRecord,
      usedInviteCount: eventRecord.usedInviteCount + 1,
      registeredWalletCount: eventRecord.registeredWalletCount + 1,
      updatedAt: registeredAt,
    };
  });

  return {
    eventKey,
    authorizationTxHash,
    alreadyRegistered: false,
  };
};

export const getPrivateEventSummary = async (contractAddress: string, eventId: number) => {
  const eventKey = buildEventKey(contractAddress, eventId);
  const [store, onChainEvent] = await Promise.all([readPrivateVotingStore(), getSepoliaEventSnapshot(contractAddress, eventId)]);

  if (onChainEvent.isPublic) {
    throw new HttpError(400, "Invite-token stats are only tracked for restricted (non-public) events.");
  }

  const existing = store.events[eventKeyForStore(eventKey)] ?? null;
  const updatedAt = nowIso();

  if (existing) {
    const organizerWallet =
      typeof existing.organizerWallet === "string" && existing.organizerWallet.trim().length > 0
        ? existing.organizerWallet
        : onChainEvent.creator;
    const updated = buildPrivateEventRecord(contractAddress, eventId, eventKey, onChainEvent, organizerWallet, existing, updatedAt);
    await runPrivateVotingStoreTransaction(async (state) => {
      state.events[eventKeyForStore(eventKey)] = updated;
    });
    return updated;
  }

  return buildPrivateEventRecord(contractAddress, eventId, eventKey, onChainEvent, onChainEvent.creator, null, updatedAt);
};

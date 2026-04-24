import { firestore } from "../firebaseAdmin.js";
import { HttpError } from "../errors.js";
import type { InviteRecord, PrivateEventRecord, RegistrationRecord } from "../types.js";
import { buildEventKey, generateOpaqueToken, hashOpaqueToken, normalizeAddress, nowIso } from "../utils/crypto.js";
import { assertSignedByWallet, buildInviteCreationMessage, buildRegistrationMessage } from "../utils/signature.js";
import {
  authorizePrivateEventVoter,
  getSepoliaEventProposals,
  getSepoliaEventSnapshot,
  type OnChainEventSnapshot,
} from "./sepoliaContractService.js";

const collections = {
  events: "privateVotingEvents",
  invites: "privateVotingInvites",
  registrations: "privateVotingRegistrations",
} as const;

const eventRef = (eventKey: string) => firestore.collection(collections.events).doc(eventKey);
const inviteRef = (eventKey: string, tokenHash: string) => firestore.collection(collections.invites).doc(`${eventKey}_${tokenHash}`);
const registrationRef = (eventKey: string, walletAddress: string) =>
  firestore.collection(collections.registrations).doc(`${eventKey}_${normalizeAddress(walletAddress)}`);

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

const syncPrivateEventRecord = async (
  contractAddress: string,
  eventId: number,
  organizerWalletHint?: string,
): Promise<PrivateEventRecord | null> => {
  const eventKey = buildEventKey(contractAddress, eventId);
  const [snapshot, onChainEvent] = await Promise.all([
    eventRef(eventKey).get(),
    getSepoliaEventSnapshot(contractAddress, eventId),
  ]);

  if (!snapshot.exists) {
    return null;
  }

  const existing = snapshot.data() as PrivateEventRecord;
  const updated = buildPrivateEventRecord(contractAddress, eventId, eventKey, onChainEvent, organizerWalletHint ?? existing.organizerWallet, existing, nowIso());
  await eventRef(eventKey).set(updated);
  return updated;
};

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

  await firestore.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef(eventKey));
    const existing = eventSnapshot.exists ? (eventSnapshot.data() as Partial<PrivateEventRecord>) : null;

    const eventRecord = buildPrivateEventRecord(input.contractAddress, input.eventId, eventKey, onChainEvent, input.organizerWallet, existing, issuedAt);
    eventRecord.inviteCount = (existing?.inviteCount ?? 0) + input.inviteCount;
    transaction.set(eventRef(eventKey), eventRecord);

    for (const inviteToken of inviteTokens) {
      const tokenHash = hashOpaqueToken(inviteToken);
      const record: InviteRecord = {
        id: `${eventKey}_${tokenHash}`,
        eventKey,
        tokenHash,
        issuedByWallet: normalizeAddress(input.organizerWallet),
        expiresAt: input.expiresAt ?? null,
        usedAt: null,
        usedByWallet: null,
        authorizationTxHash: null,
        createdAt: issuedAt,
        updatedAt: issuedAt,
      };

      transaction.set(inviteRef(eventKey, tokenHash), record);
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

  const [onChainEvent, existingEventSnapshot, existingInviteSnapshot, existingRegistrationSnapshot] = await Promise.all([
    getSepoliaEventSnapshot(input.contractAddress, input.eventId),
    eventRef(eventKey).get(),
    inviteRef(eventKey, inviteTokenHash).get(),
    registrationRef(eventKey, walletAddress).get(),
  ]);

  if (onChainEvent.isPublic) {
    throw new HttpError(400, "This event is public and does not require invite-token registration.");
  }

  if (!existingEventSnapshot.exists) {
    throw new HttpError(404, "This private event has not been prepared in the backend yet. Create invite tokens first.");
  }

  if (!existingInviteSnapshot.exists) {
    throw new HttpError(404, "Invalid invite token.");
  }

  if (existingRegistrationSnapshot.exists) {
    const existingRegistration = existingRegistrationSnapshot.data() as RegistrationRecord;
    return {
      eventKey,
      authorizationTxHash: existingRegistration.authorizationTxHash,
      alreadyRegistered: true,
    };
  }

  const invite = existingInviteSnapshot.data() as InviteRecord;

  if (invite.usedAt) {
    throw new HttpError(409, "This invite token has already been used.");
  }

  if (invite.expiresAt && Date.parse(invite.expiresAt) < Date.now()) {
    throw new HttpError(410, "This invite token has expired.");
  }

  const proposals = await getSepoliaEventProposals(input.contractAddress, input.eventId);
  if (proposals.length !== onChainEvent.proposalCount) {
    throw new HttpError(409, "The event proposals are not available on-chain yet. Try again in a moment.");
  }

  const authorizationTxHash = await authorizePrivateEventVoter(input.contractAddress, input.eventId, walletAddress);

  await firestore.runTransaction(async (transaction) => {
    const [eventSnapshot, inviteSnapshot, registrationSnapshot] = await Promise.all([
      transaction.get(eventRef(eventKey)),
      transaction.get(inviteRef(eventKey, inviteTokenHash)),
      transaction.get(registrationRef(eventKey, walletAddress)),
    ]);

    if (!eventSnapshot.exists) {
      throw new HttpError(404, "This private event has not been prepared in the backend yet. Create invite tokens first.");
    }

    if (!inviteSnapshot.exists) {
      throw new HttpError(404, "Invalid invite token.");
    }

    if (registrationSnapshot.exists) {
      return;
    }

    const currentInvite = inviteSnapshot.data() as InviteRecord;

    if (currentInvite.usedAt) {
      throw new HttpError(409, "This invite token has already been used.");
    }

    const registration: RegistrationRecord = {
      id: registrationRef(eventKey, walletAddress).id,
      eventKey,
      walletAddress,
      inviteTokenHash,
      registeredAt,
      authorizationTxHash,
      updatedAt: registeredAt,
    };

    transaction.set(registrationRef(eventKey, walletAddress), registration);
    transaction.update(inviteRef(eventKey, inviteTokenHash), {
      usedAt: registeredAt,
      usedByWallet: walletAddress,
      authorizationTxHash,
      updatedAt: registeredAt,
    } satisfies Partial<InviteRecord>);

    const eventRecord = eventSnapshot.data() as PrivateEventRecord;
    transaction.update(eventRef(eventKey), {
      usedInviteCount: eventRecord.usedInviteCount + 1,
      registeredWalletCount: eventRecord.registeredWalletCount + 1,
      updatedAt: registeredAt,
    } satisfies Partial<PrivateEventRecord>);
  });

  return {
    eventKey,
    authorizationTxHash,
    alreadyRegistered: false,
  };
};

export const submitAnonymousVote = async (_input: unknown) => {
  throw new HttpError(410, "Private invite events now vote directly on Sepolia from the registered wallet.");
};

export const getPrivateEventSummary = async (contractAddress: string, eventId: number) => {
  const record = await syncPrivateEventRecord(contractAddress, eventId);

  if (!record) {
    throw new HttpError(404, "No private voting backend record exists for this event yet.");
  }

  return record;
};

export const getPrivateEventResults = async (contractAddress: string, eventId: number) => {
  const [eventRecord, proposals] = await Promise.all([
    syncPrivateEventRecord(contractAddress, eventId),
    getSepoliaEventProposals(contractAddress, eventId),
  ]);

  if (!eventRecord) {
    throw new HttpError(404, "No private voting backend record exists for this event yet.");
  }

  const tallies = proposals.reduce<Record<string, number>>((accumulator, proposal) => {
    proposal.voteCounts.forEach((count, optionIndex) => {
      accumulator[`${proposal.id}:${optionIndex}`] = count;
    });
    return accumulator;
  }, {});

  return {
    event: eventRecord,
    tallies,
    totalVotes: proposals.reduce(
      (sum, proposal) => sum + proposal.voteCounts.reduce((proposalSum, count) => proposalSum + count, 0),
      0,
    ),
  };
};

export const getPrivateVoteTokenStatus = async (_contractAddress: string, _eventId: number, _voteToken: string) => {
  throw new HttpError(410, "Private invite events now vote directly on Sepolia from the registered wallet.");
};

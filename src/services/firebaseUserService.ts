import { collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirestoreDb } from "../lib/firebase";
import type { FirebaseContractRecord, FirebaseEventRecord, FirebaseUserProfile } from "../types/firebase";
import type { AppTestnet } from "../types/voting";

const profileDocId = (profile: { email?: string | null; walletAddress: string }): string =>
  profile.email?.trim()
    ? `email_${profile.email.trim().toLowerCase()}`
    : `wallet_${profile.walletAddress.trim().toLowerCase()}`;
const contractDocId = (network: AppTestnet, contractAddress: string): string => `${network}_${contractAddress.trim().toLowerCase()}`;
const eventDocId = (network: AppTestnet, contractAddress: string, eventId: number): string =>
  `${network}_${contractAddress.trim().toLowerCase()}_${eventId}`;

export const upsertFirebaseUserProfile = async (profile: {
  email?: string | null;
  walletAddress: string;
  walletSource?: "internal" | "metamask" | "coinbase";
}): Promise<void> => {
  const usersCollection = collection(getFirestoreDb(), "users");
  const normalizedEmail = profile.email?.trim().toLowerCase() || null;
  const recordRef = doc(usersCollection, profileDocId(profile));
  const existing = await getDoc(recordRef);

  await setDoc(
    recordRef,
    {
      email: normalizedEmail,
      walletAddress: profile.walletAddress,
      walletSource: profile.walletSource ?? "internal",
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const deleteFirebaseUserProfile = async (profile: {
  email?: string | null;
  walletAddress: string;
}): Promise<void> => {
  const usersCollection = collection(getFirestoreDb(), "users");
  const recordRef = doc(usersCollection, profileDocId(profile));
  await deleteDoc(recordRef);
};

export const getFirebaseUserProfile = async (email: string): Promise<FirebaseUserProfile | null> => {
  const usersCollection = collection(getFirestoreDb(), "users");
  const recordRef = doc(usersCollection, profileDocId({ email, walletAddress: "" }));
  const snapshot = await getDoc(recordRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    email: (data.email as string | null | undefined) ?? null,
    walletAddress: data.walletAddress as string,
    walletSource: (data.walletSource as "internal" | "metamask" | "coinbase" | undefined) ?? "internal",
    createdAt: data.createdAt?.toDate?.()?.toISOString?.(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
  };
};

export const upsertFirebaseContractRecord = async (record: FirebaseContractRecord): Promise<void> => {
  const contractsCollection = collection(getFirestoreDb(), "contracts");
  const recordRef = doc(contractsCollection, contractDocId(record.network as AppTestnet, record.contractAddress));
  const existing = await getDoc(recordRef);

  await setDoc(
    recordRef,
    {
      network: record.network,
      networkLabel: record.networkLabel,
      contractAddress: record.contractAddress,
      status: record.status,
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const upsertFirebaseEventRecord = async (record: FirebaseEventRecord): Promise<void> => {
  const eventsCollection = collection(getFirestoreDb(), "events");
  const recordRef = doc(eventsCollection, eventDocId(record.network as AppTestnet, record.contractAddress, record.eventId));
  const existing = await getDoc(recordRef);

  await setDoc(
    recordRef,
    {
      network: record.network,
      networkLabel: record.networkLabel,
      contractAddress: record.contractAddress,
      eventId: record.eventId,
      title: record.title,
      description: record.description,
      creatorWalletAddress: record.creatorWalletAddress,
      creatorEmail: record.creatorEmail ?? null,
      mode: record.mode,
      isPublic: record.isPublic,
      allowedVoterCount: record.allowedVoterCount,
      proposalCount: record.proposalCount,
      startTime: record.startTime,
      endTime: record.endTime,
      transactionHash: record.transactionHash,
      status: record.status,
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

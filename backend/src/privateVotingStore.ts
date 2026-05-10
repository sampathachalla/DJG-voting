import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpError } from "./errors.js";
import type { InviteRecord, PrivateEventRecord, RegistrationRecord } from "./types.js";

interface PrivateVotingStoreState {
  events: Record<string, PrivateEventRecord>;
  invites: Record<string, InviteRecord>;
  registrations: Record<string, RegistrationRecord>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.resolve(__dirname, "../.demo-private-voting-store.json");

const createEmptyState = (): PrivateVotingStoreState => ({
  events: {},
  invites: {},
  registrations: {},
});

let transactionQueue: Promise<void> = Promise.resolve();

const ensureStoreDir = async (): Promise<void> => {
  await mkdir(path.dirname(storePath), { recursive: true });
};

const loadState = async (): Promise<PrivateVotingStoreState> => {
  await ensureStoreDir();

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PrivateVotingStoreState>;
    return {
      events: parsed.events ?? {},
      invites: parsed.invites ?? {},
      registrations: parsed.registrations ?? {},
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createEmptyState();
    }

    if (error instanceof SyntaxError) {
      throw new HttpError(
        500,
        "Private voting store file is corrupted or not valid JSON. Remove or repair backend/.demo-private-voting-store.json.",
      );
    }

    throw error;
  }
};

const saveState = async (state: PrivateVotingStoreState): Promise<void> => {
  await ensureStoreDir();
  await writeFile(storePath, JSON.stringify(state, null, 2));
};

export const readPrivateVotingStore = async (): Promise<PrivateVotingStoreState> => loadState();

export const runPrivateVotingStoreTransaction = async <T>(
  callback: (state: PrivateVotingStoreState) => Promise<T>,
): Promise<T> => {
  let release: () => void = () => {};
  const nextTurn = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previousTurn = transactionQueue;
  transactionQueue = previousTurn.then(() => nextTurn);

  await previousTurn;

  try {
    const state = await loadState();
    const result = await callback(state);
    await saveState(state);
    return result;
  } finally {
    release();
  }
};

import type { LocalAccountRecord, WalletSession } from "../types/voting";

const ACCOUNTS_KEY = "dojaga.wallet.accounts";
const SESSION_KEY = "dojaga.wallet.session";

const readAccounts = (): LocalAccountRecord[] => {
  const raw = localStorage.getItem(ACCOUNTS_KEY);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as LocalAccountRecord[];
  } catch {
    return [];
  }
};

const writeAccounts = (accounts: LocalAccountRecord[]): void => {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const upsertLocalAccount = (account: LocalAccountRecord): void => {
  const accounts = readAccounts();
  const nextAccounts = accounts.filter((entry) => entry.email !== account.email);
  nextAccounts.push(account);
  writeAccounts(nextAccounts);
};

export const getLocalAccountByEmail = (email: string): LocalAccountRecord | null => {
  return readAccounts().find((entry) => entry.email.toLowerCase() === email.toLowerCase()) ?? null;
};

export const deleteLocalAccountByEmail = (email: string): void => {
  const nextAccounts = readAccounts().filter((entry) => entry.email.toLowerCase() !== email.toLowerCase());
  writeAccounts(nextAccounts);
};

export const saveWalletSession = (session: WalletSession): void => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const getWalletSession = (): WalletSession | null => {
  const raw = sessionStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as WalletSession;
  } catch {
    return null;
  }
};

export const clearWalletSession = (): void => {
  sessionStorage.removeItem(SESSION_KEY);
};

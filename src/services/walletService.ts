import { ethers } from "ethers";
import * as CryptoJS from "crypto-js";

/**
 * Shape of wallet data returned when creating a new wallet.
 */
export interface NewWalletData {
  address: string;
  privateKey: string;
  seedPhrase?: string;
}

/**
 * Creates a brand-new Ethereum wallet locally (non-custodial).
 *
 * What this generates:
 * - `address`: Public wallet address you can share.
 * - `privateKey`: Secret key used to sign transactions.
 * - `seedPhrase`: Human-readable recovery phrase (if available).
 *
 * Security note:
 * - Never send `privateKey` or `seedPhrase` to any server.
 * - Store them only on the user's device in encrypted form.
 */
export const createNewWallet = (): NewWalletData => {
  // createRandom() builds a wallet using secure randomness from the environment.
  const wallet = ethers.Wallet.createRandom();

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    seedPhrase: wallet.mnemonic?.phrase,
  };
};

/**
 * Encrypts a private key using a user password.
 *
 * Output is a ciphertext string that can be stored in localStorage,
 * IndexedDB, or any client-side storage mechanism.
 */
export const encryptPrivateKey = (privateKey: string, password: string): string => {
  return CryptoJS.AES.encrypt(privateKey, password).toString();
};

/**
 * Decrypts an encrypted private key using the same password.
 *
 * Returns:
 * - Original private key when password is correct.
 * - Empty string when password is wrong or data is invalid.
 */
export const decryptPrivateKey = (encryptedData: string, password: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, password);
  return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Optional helper to validate that a decrypted string looks like
 * a standard Ethereum private key (0x + 64 hex chars).
 */
export const isValidPrivateKey = (value: string): boolean => {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
};

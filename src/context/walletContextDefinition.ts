import { createContext } from "react";
import type { JsonRpcSigner, Wallet } from "ethers";
import type { AppTestnet, LocalAccountRecord, WalletSource } from "../types/voting";

export interface WalletContextValue {
  walletAddress: string | null;
  email: string | null;
  walletSource: WalletSource | null;
  signer: JsonRpcSigner | Wallet | null;
  balance: string | null;
  isRestoringSession: boolean;
  activeNetwork: AppTestnet;
  isCorrectNetwork: boolean;
  unlockInternalWallet: (account: LocalAccountRecord, password: string, options?: { refreshState?: boolean }) => Promise<void>;
  connectMetaMask: () => Promise<string>;
  connectCoinbaseWallet: () => Promise<string>;
  setActiveNetwork: (network: AppTestnet) => Promise<void>;
  refreshWalletState: (addressOverride?: string, signerOverride?: JsonRpcSigner | Wallet | null) => Promise<void>;
  lockWallet: () => Promise<void>;
  deleteInternalAccount: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextValue | undefined>(undefined);

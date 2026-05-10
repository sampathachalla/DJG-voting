import { createCoinbaseWalletSDK } from "@coinbase/wallet-sdk";
import { BrowserProvider } from "ethers";
import { getSupportedTestnets, getTestnetDefinition } from "../contracts/config";
import type { AppTestnet } from "../types/voting";

let coinbaseSdk: ReturnType<typeof createCoinbaseWalletSDK> | null = null;

const appChainIds = (): number[] =>
  getSupportedTestnets().map((network) => getTestnetDefinition(network).chainId);

export const getCoinbaseWalletEip1193Provider = (): ReturnType<ReturnType<typeof createCoinbaseWalletSDK>["getProvider"]> => {
  if (!coinbaseSdk) {
    coinbaseSdk = createCoinbaseWalletSDK({
      appName: "DoJaGa Voting Wallet",
      appLogoUrl: null,
      appChainIds: appChainIds(),
      preference: { options: "all" },
    });
  }
  return coinbaseSdk.getProvider();
};

export const getCoinbaseBrowserProvider = (): BrowserProvider => {
  return new BrowserProvider(getCoinbaseWalletEip1193Provider());
};

export const disconnectCoinbaseWalletSession = async (): Promise<void> => {
  if (!coinbaseSdk) {
    return;
  }

  try {
    await coinbaseSdk.getProvider().disconnect();
  } catch {
    // Coinbase Wallet may not support disconnect in all environments.
  }

  coinbaseSdk = null;
};

export const isCoinbaseConfiguredNetwork = (network: AppTestnet, chainIdHex: string): boolean => {
  const id = Number(chainIdHex);
  return (
    (network === "sepolia" && (id === 11155111 || chainIdHex === "0xaa36a7")) ||
    (network === "amoy" && (id === 80002 || chainIdHex === "0x13882"))
  );
};

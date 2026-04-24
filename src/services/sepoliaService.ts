import { BrowserProvider, ethers } from "ethers";
import { getChainSwitchParams, getContractConfig, getDefaultTestnet, getTestnetDefinition, hasCustomRpcUrl } from "../contracts/config";
import type { AppTestnet } from "../types/voting";

const providers = new Map<AppTestnet, ethers.JsonRpcProvider>();

export const getActiveTestnet = (network?: AppTestnet): AppTestnet => network ?? getDefaultTestnet();

export const getRpcProvider = (network: AppTestnet = getDefaultTestnet()): ethers.JsonRpcProvider => {
  const resolvedNetwork = getActiveTestnet(network);

  if (!providers.has(resolvedNetwork)) {
    const definition = getTestnetDefinition(resolvedNetwork);
    const provider = new ethers.JsonRpcProvider(definition.rpcUrl, definition.chainId, {
      staticNetwork: true,
    });
    provider.pollingInterval = 15000;
    providers.set(resolvedNetwork, provider);
  }

  return providers.get(resolvedNetwork)!;
};

export const hasCustomRpcForNetwork = (network: AppTestnet): boolean => hasCustomRpcUrl(network);

export const connectWalletToTestnet = (privateKey: string, network: AppTestnet): ethers.Wallet => {
  return new ethers.Wallet(privateKey, getRpcProvider(network));
};

export const getTestnetBalance = async (address: string, network: AppTestnet): Promise<string> => {
  const balanceWei = await getRpcProvider(network).getBalance(address);
  return ethers.formatEther(balanceWei);
};

export const isSignerOnTestnet = async (
  signer: ethers.Wallet | ethers.JsonRpcSigner | null,
  network: AppTestnet,
): Promise<boolean> => {
  if (!signer) {
    return false;
  }

  if (signer instanceof ethers.Wallet) {
    return true;
  }

  if (!signer.provider) {
    return false;
  }

  try {
    const activeNetwork = await signer.provider.getNetwork();
    return activeNetwork.chainId === BigInt(getTestnetDefinition(network).chainId);
  } catch {
    return false;
  }
};

export const switchMetaMaskToTestnet = async (network: AppTestnet): Promise<void> => {
  if (!window.ethereum) {
    throw new Error("MetaMask is not available in this browser.");
  }

  const { chainId, ...chainParams } = getChainSwitchParams(network);

  try {
    await window.ethereum.request?.({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (switchError) {
    const error = switchError as { code?: number };

    if (error.code !== 4902) {
      throw switchError;
    }

    await window.ethereum.request?.({
      method: "wallet_addEthereumChain",
      params: [{ chainId, ...chainParams }],
    });
  }
};

export const getExplorerTxUrl = (transactionHash: string, network: AppTestnet = getDefaultTestnet()): string => {
  return `${getContractConfig(network).explorerBaseUrl}/tx/${transactionHash}`;
};

export const getExplorerAddressUrl = (address: string, network: AppTestnet = getDefaultTestnet()): string => {
  return `${getContractConfig(network).explorerBaseUrl}/address/${address}`;
};

export const getCurrentNetworkLabel = (network: AppTestnet): string => getContractConfig(network).networkLabel;

export const getCurrentTokenSymbol = (network: AppTestnet): string => getContractConfig(network).nativeTokenSymbol;

export const getCurrentChainId = (network: AppTestnet): number => getContractConfig(network).chainId;

export const getBrowserProvider = (): BrowserProvider => {
  if (!window.ethereum) {
    throw new Error("MetaMask is not available in this browser.");
  }

  return new BrowserProvider(window.ethereum);
};

export const disconnectMetaMaskSite = async (): Promise<void> => {
  if (!window.ethereum?.request) {
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Some MetaMask versions/providers do not support revoking permissions.
    // We still clear local app state even if the wallet-side revoke is unavailable.
  }
};

export const getMetaMaskDeepLink = (targetUrl?: string): string => {
  const resolvedUrl =
    targetUrl ??
    (typeof window !== "undefined" ? window.location.href : "https://metamask.io");

  return `https://metamask.app.link/dapp/${resolvedUrl.replace(/^https?:\/\//, "")}`;
};

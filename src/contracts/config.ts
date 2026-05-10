import type { AppTestnet, ContractConfig } from "../types/voting";

/** Default Sepolia JSON-RPC used when `VITE_SEPOLIA_RPC_URL` is unset and as a read fallback when a custom RPC fails (e.g. rate limits). */
export const SEPOLIA_PUBLIC_RPC_FALLBACK = "https://ethereum-sepolia-rpc.publicnode.com";

type TestnetDefinition = {
  networkLabel: string;
  chainId: number;
  nativeTokenSymbol: string;
  rpcUrl: string;
  explorerBaseUrl: string;
  contractAddress: string;
  chainHex: string;
  chainName: string;
  rpcEnvKey: string;
  contractEnvKey: string;
  explorerEnvKey: string;
};

const readDefaultTestnet = (): AppTestnet => {
  const configured = (import.meta.env.VITE_DEFAULT_TESTNET as string | undefined)?.toLowerCase();
  return configured === "amoy" ? "amoy" : "sepolia";
};

const getTestnetDefinitions = (): Record<AppTestnet, TestnetDefinition> => ({
  sepolia: {
    networkLabel: "Ethereum Sepolia",
    chainId: 11155111,
    nativeTokenSymbol: "ETH",
    rpcUrl: (import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined) ?? SEPOLIA_PUBLIC_RPC_FALLBACK,
    explorerBaseUrl:
      (import.meta.env.VITE_SEPOLIA_BLOCK_EXPLORER_BASE_URL as string | undefined) ??
      (import.meta.env.VITE_BLOCK_EXPLORER_BASE_URL as string | undefined) ??
      "https://sepolia.etherscan.io",
    contractAddress:
      (import.meta.env.VITE_SEPOLIA_VOTING_CONTRACT_ADDRESS as string | undefined) ??
      (import.meta.env.VITE_VOTING_CONTRACT_ADDRESS as string | undefined) ??
      "",
    chainHex: "0xaa36a7",
    chainName: "Sepolia",
    rpcEnvKey: "VITE_SEPOLIA_RPC_URL",
    contractEnvKey: "VITE_SEPOLIA_VOTING_CONTRACT_ADDRESS",
    explorerEnvKey: "VITE_SEPOLIA_BLOCK_EXPLORER_BASE_URL",
  },
  amoy: {
    networkLabel: "Polygon Amoy",
    chainId: 80002,
    nativeTokenSymbol: "POL",
    rpcUrl: (import.meta.env.VITE_AMOY_RPC_URL as string | undefined) ?? "https://rpc-amoy.polygon.technology",
    explorerBaseUrl:
      (import.meta.env.VITE_AMOY_BLOCK_EXPLORER_BASE_URL as string | undefined) ?? "https://amoy.polygonscan.com",
    contractAddress: (import.meta.env.VITE_AMOY_VOTING_CONTRACT_ADDRESS as string | undefined) ?? "",
    chainHex: "0x13882",
    chainName: "Polygon Amoy",
    rpcEnvKey: "VITE_AMOY_RPC_URL",
    contractEnvKey: "VITE_AMOY_VOTING_CONTRACT_ADDRESS",
    explorerEnvKey: "VITE_AMOY_BLOCK_EXPLORER_BASE_URL",
  },
});

export const getSupportedTestnets = (): AppTestnet[] => ["sepolia", "amoy"];

export const getDefaultTestnet = (): AppTestnet => readDefaultTestnet();

export const getTestnetDefinition = (network: AppTestnet): TestnetDefinition => getTestnetDefinitions()[network];

export const getContractConfig = (network: AppTestnet = getDefaultTestnet()): ContractConfig => {
  const definition = getTestnetDefinition(network);

  return {
    network,
    networkLabel: definition.networkLabel,
    address: definition.contractAddress,
    chainId: definition.chainId,
    nativeTokenSymbol: definition.nativeTokenSymbol,
    explorerBaseUrl: definition.explorerBaseUrl,
  };
};

export const hasVotingContractAddress = (network: AppTestnet = getDefaultTestnet()): boolean => {
  return Boolean(getContractConfig(network).address);
};

export const hasCustomRpcUrl = (network: AppTestnet): boolean => {
  const envKey = getTestnetDefinition(network).rpcEnvKey;
  return Boolean(import.meta.env[envKey as keyof ImportMetaEnv]);
};

/**
 * URLs used for read-only RPC (balance, contract reads). When you set a custom
 * `VITE_SEPOLIA_RPC_URL` (e.g. 1rpc) that rate-limits, we append
 * {@link SEPOLIA_PUBLIC_RPC_FALLBACK} so `ethers.FallbackProvider` can succeed on the backup.
 */
export const getSepoliaReadRpcUrlCandidates = (): string[] => {
  const raw = (import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined)?.trim();
  const primary = raw || SEPOLIA_PUBLIC_RPC_FALLBACK;
  const urls = [primary];
  if (primary !== SEPOLIA_PUBLIC_RPC_FALLBACK) {
    urls.push(SEPOLIA_PUBLIC_RPC_FALLBACK);
  }
  return urls;
};

export const getChainSwitchParams = (network: AppTestnet) => {
  const definition = getTestnetDefinition(network);

  return {
    chainId: definition.chainHex,
    chainName: definition.chainName,
    nativeCurrency: {
      name: definition.nativeTokenSymbol,
      symbol: definition.nativeTokenSymbol,
      decimals: 18,
    },
    rpcUrls: [definition.rpcUrl],
    blockExplorerUrls: [definition.explorerBaseUrl],
  };
};

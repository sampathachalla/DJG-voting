/**
 * Wallet activity (recent transactions) lookup.
 *
 * Uses the Etherscan v2 unified API (https://api.etherscan.io/v2/api) when a
 * key is supplied via VITE_ETHERSCAN_API_KEY (or the network-specific
 * VITE_SEPOLIA_ETHERSCAN_API_KEY). When no key is configured we surface a
 * helper state so the UI can prompt the user with a deep link to the explorer
 * address page instead of silently looking empty.
 */

import { getContractConfig, getTestnetDefinition } from "../contracts/config";
import type { AppTestnet } from "../types/voting";

export type WalletActivityKind = "send" | "receive" | "self" | "contract";

export interface WalletActivityItem {
  hash: string;
  blockNumber: number;
  timestamp: number; // unix seconds
  from: string;
  to: string | null;
  valueWei: string;
  valueEth: string;
  status: "success" | "failed" | "pending";
  kind: WalletActivityKind;
  isContractCall: boolean;
  methodLabel?: string;
  explorerUrl: string;
}

export interface WalletActivityResult {
  items: WalletActivityItem[];
  /** `etherscan` = V2 API with your key; `blockscout` = public indexer (Sepolia, no key); `none` = could not load */
  source: "etherscan" | "blockscout" | "none";
  /** True when `VITE_*_ETHERSCAN_API_KEY` / `VITE_ETHERSCAN_API_KEY` was used */
  hasApiKey: boolean;
  errorMessage?: string;
}

const readEtherscanApiKey = (network: AppTestnet): string | undefined => {
  const networkSpecific =
    network === "sepolia"
      ? (import.meta.env.VITE_SEPOLIA_ETHERSCAN_API_KEY as string | undefined)
      : (import.meta.env.VITE_AMOY_ETHERSCAN_API_KEY as string | undefined);

  return networkSpecific || (import.meta.env.VITE_ETHERSCAN_API_KEY as string | undefined);
};

export const hasEtherscanApiKey = (network: AppTestnet): boolean => Boolean(readEtherscanApiKey(network));

/** Sepolia has a public Blockscout tx list API (no key). Amoy still needs an Etherscan-style key for in-app history. */
export const hasPublicActivityIndexer = (network: AppTestnet): boolean => network === "sepolia";

const getBlockscoutApiBase = (network: AppTestnet): string | null => {
  if (network === "sepolia") {
    return "https://eth-sepolia.blockscout.com/api";
  }
  return null;
};

const formatWeiToEthString = (wei: string): string => {
  if (!wei || wei === "0") {
    return "0";
  }

  // Manual divide to avoid pulling in BigInt-only ethers calls; values are decimal strings here.
  try {
    const big = BigInt(wei);
    const denom = 1_000_000_000_000_000_000n; // 1e18
    const whole = big / denom;
    const fraction = big % denom;
    const fractionStr = fraction.toString().padStart(18, "0").replace(/0+$/, "");

    if (!fractionStr) {
      return whole.toString();
    }

    const trimmed = fractionStr.slice(0, 6).replace(/0+$/, "");
    return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString();
  } catch {
    return "0";
  }
};

const classifyKind = (
  walletAddress: string,
  from: string,
  to: string | null,
  isContractCall: boolean,
): WalletActivityKind => {
  if (isContractCall) {
    return "contract";
  }

  const lowerWallet = walletAddress.toLowerCase();
  const lowerFrom = from.toLowerCase();
  const lowerTo = (to ?? "").toLowerCase();

  if (lowerFrom === lowerWallet && lowerTo === lowerWallet) {
    return "self";
  }

  if (lowerFrom === lowerWallet) {
    return "send";
  }

  return "receive";
};

interface EtherscanTxRow {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress?: string;
  isError: string;
  txreceipt_status?: string;
  functionName?: string;
  input?: string;
  methodId?: string;
}

const mapRowsToItems = (
  rows: EtherscanTxRow[],
  walletAddress: string,
  explorerBaseUrl: string,
  limit: number,
): WalletActivityItem[] =>
  rows.slice(0, limit).map<WalletActivityItem>((row) => {
    const isContractCall = Boolean(row.input && row.input !== "0x" && row.input.length > 2);
    const status: WalletActivityItem["status"] =
      row.isError === "1" || row.txreceipt_status === "0" ? "failed" : "success";

    return {
      hash: row.hash,
      blockNumber: Number(row.blockNumber || 0),
      timestamp: Number(row.timeStamp || 0),
      from: row.from,
      to: row.to || row.contractAddress || null,
      valueWei: row.value || "0",
      valueEth: formatWeiToEthString(row.value || "0"),
      status,
      kind: classifyKind(walletAddress, row.from, row.to || row.contractAddress || null, isContractCall),
      isContractCall,
      methodLabel: decodeMethodLabel(row),
      explorerUrl: `${explorerBaseUrl}/tx/${row.hash}`,
    };
  });

const decodeMethodLabel = (row: EtherscanTxRow): string | undefined => {
  if (row.functionName) {
    const cleaned = row.functionName.split("(")[0]?.trim();
    if (cleaned) {
      return cleaned;
    }
  }

  if (row.methodId && row.methodId !== "0x") {
    return row.methodId;
  }

  return undefined;
};

const fetchBlockscoutActivity = async (
  walletAddress: string,
  network: AppTestnet,
  limit: number,
  explorerBaseUrl: string,
): Promise<WalletActivityResult> => {
  const base = getBlockscoutApiBase(network);
  if (!base) {
    return { items: [], source: "none", hasApiKey: false };
  }

  const params = new URLSearchParams({
    module: "account",
    action: "txlist",
    address: walletAddress,
    startblock: "0",
    endblock: "99999999",
    page: "1",
    offset: String(limit),
    sort: "desc",
  });

  try {
    const response = await fetch(`${base}?${params.toString()}`);

    if (!response.ok) {
      return {
        items: [],
        source: "blockscout",
        hasApiKey: false,
        errorMessage: `Blockscout responded with HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as {
      status: string | number;
      message: string;
      result: EtherscanTxRow[] | string;
    };

    const statusOk = String(payload.status) === "1";
    if (!statusOk) {
      const message = typeof payload.result === "string" ? payload.result : payload.message;
      if (typeof message === "string" && message.toLowerCase().includes("no transactions")) {
        return { items: [], source: "blockscout", hasApiKey: false };
      }
      return {
        items: [],
        source: "blockscout",
        hasApiKey: false,
        errorMessage: typeof message === "string" ? message : "Blockscout returned an unexpected response.",
      };
    }

    const rows = Array.isArray(payload.result) ? payload.result : [];
    const items = mapRowsToItems(rows, walletAddress, explorerBaseUrl, limit);
    return { items, source: "blockscout", hasApiKey: false };
  } catch (error) {
    return {
      items: [],
      source: "blockscout",
      hasApiKey: false,
      errorMessage: error instanceof Error ? error.message : "Could not reach Blockscout.",
    };
  }
};

export const fetchWalletActivity = async (
  walletAddress: string,
  network: AppTestnet,
  options?: { limit?: number },
): Promise<WalletActivityResult> => {
  const limit = Math.max(1, Math.min(options?.limit ?? 10, 25));
  const apiKey = readEtherscanApiKey(network);
  const { explorerBaseUrl } = getContractConfig(network);

  if (apiKey) {
    const chainId = getTestnetDefinition(network).chainId;
    const params = new URLSearchParams({
      chainid: String(chainId),
      module: "account",
      action: "txlist",
      address: walletAddress,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: String(limit),
      sort: "desc",
      apikey: apiKey,
    });

    try {
      const response = await fetch(`https://api.etherscan.io/v2/api?${params.toString()}`);

      if (!response.ok) {
        return {
          items: [],
          source: "etherscan",
          hasApiKey: true,
          errorMessage: `Explorer responded with HTTP ${response.status}.`,
        };
      }

      const payload = (await response.json()) as { status: string; message: string; result: EtherscanTxRow[] | string };

      if (payload.status !== "1") {
        const message = typeof payload.result === "string" ? payload.result : payload.message;
        if (typeof message === "string" && message.toLowerCase().includes("no transactions")) {
          return { items: [], source: "etherscan", hasApiKey: true };
        }
        return {
          items: [],
          source: "etherscan",
          hasApiKey: true,
          errorMessage: typeof message === "string" ? message : "Explorer returned an unexpected response.",
        };
      }

      const rows = Array.isArray(payload.result) ? payload.result : [];
      const items = mapRowsToItems(rows, walletAddress, explorerBaseUrl, limit);
      return { items, source: "etherscan", hasApiKey: true };
    } catch (error) {
      return {
        items: [],
        source: "etherscan",
        hasApiKey: true,
        errorMessage: error instanceof Error ? error.message : "Could not reach the block explorer.",
      };
    }
  }

  if (hasPublicActivityIndexer(network)) {
    return fetchBlockscoutActivity(walletAddress, network, limit, explorerBaseUrl);
  }

  return {
    items: [],
    source: "none",
    hasApiKey: false,
  };
};

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getContractConfig, getSupportedTestnets } from "../contracts/config";
import { useWallet } from "../hooks/useWallet";
import {
  fetchWalletActivity,
  getExplorerAddressUrl,
  hasCustomRpcForNetwork,
  type WalletActivityItem,
  type WalletActivityResult,
} from "../services";
import type { AppTestnet, WalletSource } from "../types/voting";
import { formatTokenAmount } from "../utils/formatAmount";

const truncateAddress = (address: string): string =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

const truncateHash = (hash: string): string =>
  hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash;

const sourceMeta: Record<
  WalletSource,
  { label: string; tag: string; gradient: string; ring: string }
> = {
  internal: {
    label: "Vera Talley wallet",
    tag: "DJG",
    gradient: "from-[#7d3bba] via-[#8b46cd] to-[#c084fc]",
    ring: "ring-[#c4a8e8]/40",
  },
  metamask: {
    label: "MetaMask",
    tag: "MM",
    gradient: "from-[#f6851b] via-[#e2761b] to-[#cd6116]",
    ring: "ring-[#f6c39a]/50",
  },
  coinbase: {
    label: "Coinbase Wallet",
    tag: "CB",
    gradient: "from-[#1652f0] via-[#1e64ff] to-[#5b8bff]",
    ring: "ring-[#9bb6ff]/50",
  },
};

const formatTimeAgo = (timestampSeconds: number): string => {
  if (!timestampSeconds) {
    return "—";
  }
  const seconds = Math.max(1, Math.floor(Date.now() / 1000) - timestampSeconds);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  if (seconds < 604800) {
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  const date = new Date(timestampSeconds * 1000);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const kindTone: Record<WalletActivityItem["kind"], string> = {
  send: "text-[#b3261e]",
  receive: "text-[#1f7a3c]",
  self: "text-[#514769]",
  contract: "text-[#6826b5]",
};

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7V5a2 2 0 012-2h9a2 2 0 012 2v11a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v11a2 2 0 002 2h9a2 2 0 002-2v-2M8 7h9a2 2 0 012 2v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3h7v7M10 14L21 3M21 14v6a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const railShell =
  "relative flex w-full min-h-0 flex-col rounded-2xl border border-[#e7e0f1]/90 bg-gradient-to-br from-white/96 via-[#faf7ff]/95 to-[#f0f4fb]/92 shadow-md shadow-[rgba(46,38,70,0.08)] backdrop-blur-xl";

export default function WalletRail() {
  const {
    walletAddress,
    walletSource,
    email,
    balance,
    activeNetwork,
    isCorrectNetwork,
    setActiveNetwork,
    lockWallet,
    deleteInternalAccount,
  } = useWallet();

  const [copyHint, setCopyHint] = useState("");
  const [accountActionError, setAccountActionError] = useState("");
  const [activity, setActivity] = useState<WalletActivityResult | null>(null);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  const { address: votingContractAddress, networkLabel, nativeTokenSymbol } = getContractConfig(activeNetwork);
  const customRpc = hasCustomRpcForNetwork(activeNetwork);
  const explorerAddressUrl = walletAddress ? getExplorerAddressUrl(walletAddress, activeNetwork) : "";

  const sourceInfo = useMemo(() => {
    if (!walletSource) {
      return null;
    }
    return sourceMeta[walletSource];
  }, [walletSource]);

  const initial = useMemo(() => {
    if (email) {
      return email[0]?.toUpperCase() ?? "•";
    }
    if (walletAddress) {
      return walletAddress.slice(2, 3).toUpperCase();
    }
    return "•";
  }, [email, walletAddress]);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      if (!walletAddress) {
        if (!cancelled) {
          setActivity(null);
        }
        return;
      }

      if (!cancelled) {
        setIsLoadingActivity(true);
      }

      const result = await fetchWalletActivity(walletAddress, activeNetwork, { limit: 8 });

      if (!cancelled) {
        setActivity(result);
        setIsLoadingActivity(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, activeNetwork, activityRefreshKey]);

  const handleRemoveLocalAccount = useCallback(async (): Promise<void> => {
    const confirmed = window.confirm(
      "Remove this local account from this browser? This deletes the saved wallet on this device. Ensure you have your recovery phrase first.",
    );
    if (!confirmed) {
      return;
    }
    setAccountActionError("");
    try {
      await deleteInternalAccount();
    } catch (removeError) {
      setAccountActionError(removeError instanceof Error ? removeError.message : "Unable to remove account.");
    }
  }, [deleteInternalAccount]);

  const copyAddress = useCallback(async (): Promise<void> => {
    if (!walletAddress) {
      return;
    }
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopyHint("Copied");
    } catch {
      setCopyHint("Failed");
    }
    window.setTimeout(() => setCopyHint(""), 1800);
  }, [walletAddress]);

  if (!walletAddress) {
    return (
      <aside className={`${railShell} p-4`}>
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/35 to-transparent" />
        <div className="relative flex flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8b46cd] to-[#37a7bd] text-base font-black text-white shadow-lg shadow-purple-600/20">
              VT
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#6a6284]">WALLET</p>
              <p className="text-[17px] font-semibold tracking-tight text-[#2e2646]">Not connected</p>
            </div>
          </div>
          <p className="text-[14px] leading-relaxed text-[#514769]">
            Sign in for voting and organizing. Observer mode works without a wallet.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-full bg-[#8b46cd] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-600/20 transition hover:bg-[#722eaa]"
          >
            Sign in to connect
          </Link>
        </div>
      </aside>
    );
  }

  const activityFromIndexer =
    activity?.source === "etherscan" || activity?.source === "blockscout";
  const showActivityList = Boolean(activityFromIndexer && !activity?.errorMessage && activity.items.length > 0);

  return (
    <aside className={`${railShell} flex flex-col`}>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/50" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-2xl bg-gradient-to-b from-white/40 to-transparent" />

      <div className="relative flex min-h-0 flex-1 flex-col gap-0 p-4">
        {/* Wallet type + disconnect */}
        <div className="flex shrink-0 items-center gap-3">
          <div
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${sourceInfo?.gradient ?? "from-[#8b46cd] to-[#37a7bd]"} text-xs font-bold text-white shadow-md shadow-black/10 ring-2 ${sourceInfo?.ring ?? "ring-white/40"}`}
          >
            {initial}
            <span className="absolute -bottom-0.5 -right-0.5 rounded-md bg-white/95 px-1 py-px text-[9px] font-bold tracking-wide text-[#2e2646] shadow-sm">
              {sourceInfo?.tag ?? "•"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-[#2e2646]">
              {sourceInfo?.label ?? "Connected wallet"}
            </p>
            {email ? (
              <p className="truncate text-[12px] text-[#6a6284]">{email}</p>
            ) : (
              <p className="text-[12px] text-[#6a6284]">Connected</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void lockWallet()}
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#7d3bba] transition hover:bg-[#f3ebff]"
          >
            {walletSource === "internal" ? "Lock" : "Disconnect"}
          </button>
        </div>

        {/* Hero: balance + network */}
        <div className="mt-3 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#2e2646] via-[#3d2f5c] to-[#5c3d8a] p-px shadow-inner shadow-black/5">
          <div className="bg-gradient-to-br from-[#3a2f58]/95 via-[#453465]/90 to-[#5a4088]/85 px-3.5 py-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">Balance</p>
                <p className="mt-0.5 truncate text-[22px] font-semibold tracking-tight text-white tabular-nums md:text-[24px]">
                  {customRpc ? formatTokenAmount(balance) : "—"}
                  <span className="ml-1.5 text-[14px] font-medium text-white/75">{nativeTokenSymbol}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    isCorrectNetwork ? "bg-emerald-400/20 text-emerald-100" : "bg-amber-400/25 text-amber-100"
                  }`}
                >
                  <span className={`h-1 w-1 rounded-full ${isCorrectNetwork ? "bg-emerald-300" : "bg-amber-300"}`} />
                  {networkLabel}
                </span>
                {!customRpc ? (
                  <span className="text-[10px] font-medium text-amber-200/90">RPC not set</span>
                ) : null}
              </div>
            </div>
            <div className="mt-2.5 border-t border-white/10 pt-2.5">
              <label className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Network</span>
                <select
                  value={activeNetwork}
                  onChange={(event) => void setActiveNetwork(event.target.value as AppTestnet)}
                  className="min-w-0 flex-1 cursor-pointer appearance-none rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[13px] font-medium text-white outline-none transition hover:bg-white/15 focus:border-white/30 [&>option]:bg-[#2e2646] [&>option]:text-white"
                >
                  {getSupportedTestnets().map((network) => (
                    <option key={network} value={network}>
                      {getContractConfig(network).networkLabel}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Address row */}
        <div className="mt-3 flex shrink-0 items-center gap-2 rounded-lg bg-[#2e2646]/[0.04] px-2.5 py-2">
          <p className="min-w-0 flex-1 truncate font-mono text-[12px] font-medium text-[#2e2646]" title={walletAddress}>
            {truncateAddress(walletAddress)}
          </p>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#514769] transition hover:bg-white/80 hover:text-[#7d3bba]"
              aria-label="Copy address"
            >
              <CopyIcon />
            </button>
            <a
              href={explorerAddressUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#514769] transition hover:bg-white/80 hover:text-[#7d3bba]"
              aria-label="Open in explorer"
            >
              <ExternalIcon />
            </a>
          </div>
          {copyHint ? (
            <span className="shrink-0 text-[11px] font-medium text-emerald-600">{copyHint}</span>
          ) : null}
        </div>

        {votingContractAddress ? (
          <div className="mt-2.5 shrink-0 rounded-lg border border-[#e7e0f1]/80 bg-white/50 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6a6284]">Voting contract</p>
            <a
              href={getExplorerAddressUrl(votingContractAddress, activeNetwork)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate font-mono text-[12px] font-medium text-[#7d3bba] hover:underline"
              title={votingContractAddress}
            >
              {truncateAddress(votingContractAddress)}
            </a>
          </div>
        ) : null}

        {/* Activity — column scroll in Layout; no nested scroll */}
        <section className="mt-3 flex flex-col border-t border-[#2e2646]/[0.06] pt-3">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6a6284]">Activity</p>
            {activityFromIndexer ? (
              <button
                type="button"
                onClick={() => setActivityRefreshKey((current) => current + 1)}
                className="rounded-full px-2 py-1 text-[11px] font-semibold text-[#7d3bba] transition hover:bg-[#f3ebff]"
              >
                {isLoadingActivity ? "…" : "Refresh"}
              </button>
            ) : null}
          </div>

          <div className="mt-2 pr-0.5">
            {!activity || (activityFromIndexer && isLoadingActivity && activity.items.length === 0) ? (
              <ActivitySkeleton />
            ) : null}

            {activity?.errorMessage ? (
              <p className="rounded-lg bg-amber-50/90 px-3 py-2 text-[12px] leading-snug text-amber-900">
                {activity.errorMessage}
              </p>
            ) : null}

            {activity?.source === "none" && !isLoadingActivity ? (
              <div className="rounded-lg bg-[#f7f2fc]/80 px-3 py-2.5 text-[12px] leading-snug text-[#514769]">
                <p className="font-medium text-[#2e2646]">
                  {activeNetwork === "amoy"
                    ? "Add VITE_ETHERSCAN_API_KEY (or VITE_AMOY_ETHERSCAN_API_KEY) to load activity for Polygon Amoy."
                    : "Could not load activity for this network."}
                </p>
                <a
                  href={explorerAddressUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#7d3bba]"
                >
                  History on explorer <ExternalIcon className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : null}

            {activityFromIndexer && !isLoadingActivity && activity.items.length === 0 && !activity.errorMessage ? (
              <p className="py-1 text-[12px] text-[#6a6284]">No recent transactions on {networkLabel}.</p>
            ) : null}

            {activity?.items.map((item) => (
              <ActivityRow key={item.hash} item={item} walletAddress={walletAddress} />
            ))}
          </div>

          {showActivityList ? (
            <a
              href={explorerAddressUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 shrink-0 py-1 text-center text-[11px] font-semibold text-[#7d3bba] transition hover:text-[#5f2d9e]"
            >
              Full history on explorer ↗
            </a>
          ) : null}
        </section>

        {walletSource === "internal" ? (
          <div className="mt-4 shrink-0 border-t border-[#2e2646]/[0.06] pt-3">
            {accountActionError ? (
              <p className="mb-2 rounded-lg border border-red-200 bg-red-50/90 px-2.5 py-2 text-[11px] text-red-700">{accountActionError}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleRemoveLocalAccount()}
              className="text-left text-[11px] font-semibold text-red-600 underline-offset-2 transition hover:underline"
            >
              Remove account from this device
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function ActivityRow({ item, walletAddress }: { item: WalletActivityItem; walletAddress: string }) {
  const tone = kindTone[item.kind];
  const isOutgoing = item.kind === "send" || item.kind === "self";
  const counterparty = isOutgoing ? item.to : item.from;
  const counterpartyLabel = counterparty ? truncateAddress(counterparty) : "—";

  return (
    <a
      href={item.explorerUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-[#2e2646]/[0.04]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-[#2e2646]">
          {item.methodLabel ? item.methodLabel : `${isOutgoing ? "To" : "From"} ${counterpartyLabel}`}
        </p>
        <p className="truncate font-mono text-[10px] text-[#6a6284]">
          {truncateHash(item.hash)} · {formatTimeAgo(item.timestamp)}
          {item.status === "failed" ? " · failed" : ""}
          {item.from.toLowerCase() === walletAddress.toLowerCase() && item.kind === "contract" ? " · sent" : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[12px] font-semibold tabular-nums ${tone}`}>
          {item.valueWei === "0" ? "—" : `${isOutgoing ? "−" : "+"}${item.valueEth}`}
        </p>
      </div>
    </a>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-2 py-1">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-2.5 w-3/5 max-w-[140px] rounded bg-[#e7e0f1]/90" />
            <span className="block h-2 w-2/5 max-w-[88px] rounded bg-[#ece6f5]/90" />
          </div>
          <span className="h-3 w-10 shrink-0 rounded bg-[#e7e0f1]/90" />
        </div>
      ))}
    </div>
  );
}

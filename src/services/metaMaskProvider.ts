/**
 * Resolves the MetaMask EIP-1193 provider explicitly. When several wallets inject
 * into the page, `window.ethereum` may point at Coinbase or another wallet, so
 * MetaMask would never show Activity for transactions signed through that handle.
 */

import { BrowserProvider } from "ethers";

type Eip1193RequestFn = (args: { method: string; params?: unknown[] }) => Promise<unknown>;

export type Eip1193Ethereum = {
  request: Eip1193RequestFn;
  isMetaMask?: boolean;
  providers?: Eip1193Ethereum[];
};

type Eip6963AnnounceDetail = {
  info: {
    uuid: string;
    name: string;
    rdns: string;
    icon?: string;
  };
  provider: Eip1193Ethereum;
};

const announced = new Map<string, Eip6963AnnounceDetail>();

let listening = false;

const ensureListening = (): void => {
  if (listening || typeof window === "undefined") {
    return;
  }

  listening = true;

  window.addEventListener("eip6963:announceProvider", ((event: Event) => {
    const custom = event as CustomEvent<Eip6963AnnounceDetail>;
    const { detail } = custom;

    if (!detail?.provider || !detail.info?.uuid) {
      return;
    }

    announced.set(detail.info.uuid, detail);
  }) as EventListener);

  window.dispatchEvent(new Event("eip6963:requestProvider"));
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const waitForWalletDiscovery = async (ms = 300): Promise<void> => {
  ensureListening();
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await sleep(ms);
};

const getMetaMaskFromAnnounced = (): Eip1193Ethereum | null => {
  for (const entry of announced.values()) {
    if (entry.info.rdns === "io.metamask") {
      return entry.provider;
    }
  }

  return null;
};

const getMetaMaskFromWindowEthereum = (): Eip1193Ethereum | null => {
  const eth = window.ethereum as Eip1193Ethereum | undefined;

  if (!eth) {
    return null;
  }

  if (eth.isMetaMask) {
    return eth;
  }

  const multi = eth.providers;

  if (Array.isArray(multi)) {
    const mm = multi.find((p) => p.isMetaMask);

    if (mm) {
      return mm;
    }
  }

  return null;
};

let rememberedMetaMask: Eip1193Ethereum | null = null;

export const rememberMetaMaskProvider = (provider: Eip1193Ethereum): void => {
  rememberedMetaMask = provider;
};

export const getRememberedMetaMaskProvider = (): Eip1193Ethereum | null => rememberedMetaMask;

export const clearRememberedMetaMaskProvider = (): void => {
  rememberedMetaMask = null;
};

/**
 * Returns the MetaMask EIP-1193 provider, or throws if MetaMask is not available.
 */
export const getMetaMaskEip1193Provider = async (): Promise<Eip1193Ethereum> => {
  ensureListening();
  await waitForWalletDiscovery(280);

  const from6963 = getMetaMaskFromAnnounced();

  if (from6963) {
    return from6963;
  }

  const fromWindow = getMetaMaskFromWindowEthereum();

  if (fromWindow) {
    return fromWindow;
  }

  throw new Error(
    "MetaMask was not found. Install the MetaMask extension, enable it for this site, or if you use multiple wallets try disabling “default wallet” overrides in the other extension so MetaMask can connect.",
  );
};

export const getMetaMaskBrowserProvider = async (): Promise<BrowserProvider> => {
  const eip1193 = await getMetaMaskEip1193Provider();
  rememberMetaMaskProvider(eip1193);
  return new BrowserProvider(eip1193);
};

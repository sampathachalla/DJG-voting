import { useCallback, useEffect, useState } from "react";
import { ethers, JsonRpcSigner } from "ethers";
import { getContractConfig, getDefaultTestnet } from "../contracts/config";
import { clearWalletSession, deleteLocalAccountByEmail, getLocalAccountByEmail, getWalletSession, saveWalletSession } from "../services/storageService";
import { deleteCurrentFirebaseAuthUser, logoutFirebaseAuthUser } from "../services/firebaseAuthService";
import { deleteFirebaseUserProfile } from "../services/firebaseUserService";
import {
  connectWalletToTestnet,
  disconnectMetaMaskSite,
  getBrowserProvider,
  getTestnetBalance,
  hasCustomRpcForNetwork,
  switchMetaMaskToTestnet,
} from "../services/sepoliaService";
import { decryptPrivateKey, isValidPrivateKey } from "../services/walletService";
import type { AppTestnet, LocalAccountRecord, WalletSession, WalletSource } from "../types/voting";
import { WalletContext } from "./walletContextDefinition";

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeNetwork, setActiveNetworkState] = useState<AppTestnet>(getDefaultTestnet());
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [walletSource, setWalletSource] = useState<WalletSource | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | ethers.Wallet | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  const refreshWalletState = useCallback(async (
    addressOverride?: string,
    signerOverride?: JsonRpcSigner | ethers.Wallet | null,
  ): Promise<void> => {
    const address = addressOverride;
    const activeSigner = signerOverride ?? null;

    if (!address) {
      return;
    }

    if (activeSigner instanceof ethers.Wallet) {
      setIsCorrectNetwork(true);
    } else if (activeSigner?.provider) {
      try {
        const network = await activeSigner.provider.getNetwork();
        setIsCorrectNetwork(network.chainId === BigInt(getContractConfig(activeNetwork).chainId));
      } catch {
        setIsCorrectNetwork(false);
      }
    } else {
      setIsCorrectNetwork(false);
    }

    if (!hasCustomRpcForNetwork(activeNetwork)) {
      setBalance(null);
      return;
    }

    try {
      setBalance(await getTestnetBalance(address, activeNetwork));
    } catch {
      setBalance(null);
    }
  }, [activeNetwork]);

  const setSession = useCallback(async (
    session: WalletSession,
    nextSigner: JsonRpcSigner | ethers.Wallet | null,
    options?: { refreshState?: boolean },
  ): Promise<void> => {
    setWalletAddress(session.walletAddress);
    setWalletSource(session.walletSource);
    setEmail(session.email ?? null);
    setSigner(nextSigner);
    setActiveNetworkState(session.activeNetwork ?? getDefaultTestnet());
    saveWalletSession(session);

    if (options?.refreshState === false) {
      setBalance(null);
      setIsCorrectNetwork(nextSigner instanceof ethers.Wallet || session.walletSource === "internal");
      return;
    }

    await refreshWalletState(session.walletAddress, nextSigner);
  }, [refreshWalletState]);

  const unlockInternalWallet = async (
    account: LocalAccountRecord,
    password: string,
    options?: { refreshState?: boolean },
  ): Promise<void> => {
    const privateKey = decryptPrivateKey(account.encryptedPrivateKey, password);

    if (!isValidPrivateKey(privateKey)) {
      throw new Error("Invalid password for this local wallet.");
    }

    const nextSigner = connectWalletToTestnet(privateKey, activeNetwork);
    await setSession(
      {
        email: account.email,
        walletAddress: account.walletAddress,
        walletSource: "internal",
        activeNetwork,
        sessionPrivateKey: privateKey,
      },
      nextSigner,
      options,
    );
  };

  const connectMetaMask = async (): Promise<string> => {
    const provider = getBrowserProvider();
    await provider.send("eth_requestAccounts", []);
    const nextSigner = await provider.getSigner();
    const address = await nextSigner.getAddress();

    const chainId = await provider.send("eth_chainId", []);
    const isSelectedNetwork =
      (activeNetwork === "sepolia" && (Number(chainId) === 11155111 || chainId === "0xaa36a7")) ||
      (activeNetwork === "amoy" && (Number(chainId) === 80002 || chainId === "0x13882"));
    setIsCorrectNetwork(isSelectedNetwork);

    await setSession(
      {
        walletAddress: address,
        walletSource: "metamask",
        activeNetwork,
      },
      nextSigner,
    );

    return address;
  };

  const setActiveNetwork = useCallback(async (network: AppTestnet): Promise<void> => {
    setActiveNetworkState(network);

    if (!walletAddress) {
      return;
    }

    if (walletSource === "internal") {
      const session = getWalletSession();

      if (!session?.sessionPrivateKey || !isValidPrivateKey(session.sessionPrivateKey)) {
        return;
      }

      const nextSigner = connectWalletToTestnet(session.sessionPrivateKey, network);
      await setSession(
        {
          ...session,
          activeNetwork: network,
        },
        nextSigner,
      );
      return;
    }

    if (walletSource === "metamask") {
      try {
        await switchMetaMaskToTestnet(network);
        const provider = getBrowserProvider();
        const nextSigner = await provider.getSigner();
        const nextAddress = await nextSigner.getAddress();
        await setSession(
          {
            walletAddress: nextAddress,
            walletSource: "metamask",
            activeNetwork: network,
          },
          nextSigner,
        );
      } catch {
        setIsCorrectNetwork(false);
      }
    }
  }, [setSession, walletAddress, walletSource]);

  const lockWallet = async (): Promise<void> => {
    if (walletSource === "metamask") {
      await disconnectMetaMaskSite();
    }

    try {
      await logoutFirebaseAuthUser();
    } catch {
      // Best effort only. We still want to clear the local app session.
    }

    setWalletAddress(null);
    setEmail(null);
    setWalletSource(null);
    setSigner(null);
    setBalance(null);
    setIsCorrectNetwork(false);
    clearWalletSession();
  };

  const deleteInternalAccount = async (): Promise<void> => {
    if (walletSource !== "internal" || !email || !walletAddress) {
      throw new Error("Only internal wallets can be deleted from this app.");
    }

    try {
      await deleteFirebaseUserProfile({ email, walletAddress });
    } catch {
      // Best effort only. Local deletion should still complete.
    }

    try {
      await deleteCurrentFirebaseAuthUser();
    } catch {
      // Ignore Firebase auth deletion failures here; local deletion is the main action.
    }

    deleteLocalAccountByEmail(email);
    await lockWallet();
  };

  useEffect(() => {
    const restoreSession = async (): Promise<void> => {
      const session = getWalletSession();
      if (!session) {
        setIsRestoringSession(false);
        return;
      }

      const restoredNetwork = session.activeNetwork ?? getDefaultTestnet();
      setActiveNetworkState(restoredNetwork);

      if (session.walletSource === "metamask") {
        if (!window.ethereum) {
          clearWalletSession();
          setIsRestoringSession(false);
          return;
        }

        try {
          const provider = getBrowserProvider();
          const accounts = (await provider.send("eth_accounts", [])) as string[];

          if (!accounts.some((account) => account.toLowerCase() === session.walletAddress.toLowerCase())) {
            clearWalletSession();
            setIsRestoringSession(false);
            return;
          }

          const existingSigner = await provider.getSigner();
          await setSession(session, existingSigner, { refreshState: false });
        } catch {
          clearWalletSession();
        }

        setIsRestoringSession(false);
        return;
      }

      if (session.email) {
        const account = getLocalAccountByEmail(session.email);

        if (!account) {
          clearWalletSession();
          setIsRestoringSession(false);
          return;
        }

        if (!session.sessionPrivateKey || !isValidPrivateKey(session.sessionPrivateKey)) {
          clearWalletSession();
          setIsRestoringSession(false);
          return;
        }

        try {
          const restoredSigner = connectWalletToTestnet(session.sessionPrivateKey, restoredNetwork);
          await setSession({ ...session, activeNetwork: restoredNetwork }, restoredSigner, { refreshState: false });
        } catch {
          clearWalletSession();
        }
      }

      setIsRestoringSession(false);
    };

    void restoreSession();
  }, [setSession]);

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        email,
        walletSource,
        signer,
        balance,
        isRestoringSession,
        activeNetwork,
        isCorrectNetwork,
        unlockInternalWallet,
        connectMetaMask,
        setActiveNetwork,
        refreshWalletState,
        lockWallet,
        deleteInternalAccount,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

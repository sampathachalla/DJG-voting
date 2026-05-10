import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { useWallet } from "../hooks/useWallet";
import { registerFirebaseAuthUser } from "../services/firebaseAuthService";
import { upsertFirebaseUserProfile } from "../services/firebaseUserService";
import { upsertLocalAccount } from "../services/storageService";
import { createNewWallet, encryptPrivateKey } from "../services/walletService";
import type { LocalAccountRecord } from "../types/voting";

export default function Signup() {
  const navigate = useNavigate();
  const { unlockInternalWallet } = useWallet();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [walletRecord, setWalletRecord] = useState<LocalAccountRecord | null>(null);
  const [seedPhrase, setSeedPhrase] = useState<string>("");

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!acceptedRisk) {
      setError("You must confirm the non-custodial wallet warning.");
      return;
    }

    try {
      setSubmitting(true);
      const wallet = createNewWallet();
      await registerFirebaseAuthUser(email.trim().toLowerCase(), password, wallet.address);
      await upsertFirebaseUserProfile({
        email: email.trim().toLowerCase(),
        walletAddress: wallet.address,
        walletSource: "internal",
      });

      const account: LocalAccountRecord = {
        email: email.trim().toLowerCase(),
        walletAddress: wallet.address,
        encryptedPrivateKey: encryptPrivateKey(wallet.privateKey, password),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      upsertLocalAccount(account);
      setWalletRecord(account);
      setSeedPhrase(wallet.seedPhrase ?? "");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create wallet.");
    } finally {
      setSubmitting(false);
    }
  };

  const continueToDashboard = async (): Promise<void> => {
    if (!walletRecord) {
      return;
    }

    try {
      await unlockInternalWallet(walletRecord, password, { refreshState: false });
      navigate("/vote");
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Wallet created but unlock failed.");
    }
  };

  if (walletRecord) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-14 text-white">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-cyan-400/20 bg-slate-900 p-8 md:p-12">
          <div className="flex items-center gap-3">
            <img src={logo} alt="DJG Voting Wallet" className="h-14 w-auto brightness-0 invert" />
            <span className="text-2xl font-black">VOTING</span>
          </div>
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-cyan-300">Recovery phrase</p>
          <h1 className="mt-3 text-4xl font-black">Save this once and keep it offline</h1>
          <p className="mt-4 text-slate-300">
            Your wallet is ready. The private key stays on this device and is encrypted with your password. The seed phrase below will not be shown again.
          </p>
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-lg leading-9 text-cyan-100">
            {seedPhrase || "No mnemonic was returned for this wallet."}
          </div>
          <p className="mt-5 text-sm text-slate-400">Public address: {walletRecord.walletAddress}</p>
          {error ? <p className="mt-5 rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
          <button onClick={() => void continueToDashboard()} className="mt-8 rounded-full bg-cyan-400 px-6 py-3 font-bold text-slate-950">
            I saved it. Continue to the app
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0d2d2d] flex-col justify-between p-14 overflow-hidden">
        <div className="absolute top-[-120px] right-[-100px] w-[500px] h-[500px] bg-teal-500 rounded-full blur-[160px] opacity-20 pointer-events-none" />
        <div className="absolute bottom-[-100px] left-[-80px] w-[400px] h-[400px] bg-[#893ec8] rounded-full blur-[140px] opacity-25 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <img src={logo} alt="DJG Voting Wallet" className="h-16 w-auto brightness-0 invert" />
          <span className="text-white font-black text-2xl tracking-tight">VOTING</span>
        </div>
        <div className="relative z-10">
          <h2 className="text-white text-4xl font-black leading-tight tracking-tight mb-10">
            Create your wallet.<br />Store votes on Sepolia.<br />Pay no real money.
          </h2>
          <p className="text-teal-100/80 max-w-md leading-relaxed">
            Sign up creates a local non-custodial wallet, stores only your email and public address in Firebase, and keeps the signing key on your device.
          </p>
        </div>
        <p className="relative z-10 text-sm text-teal-300/80">Only Ethereum Sepolia is supported in this version.</p>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-16 bg-[#f7fafa]">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-teal-600 transition-colors">
              Back to home
            </Link>
          </div>
          <h1 className="text-3xl font-black text-[#2e2646] mb-2">Create your voting wallet</h1>
          <p className="text-gray-500 mb-8">
            Already have one?{" "}
            <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-500 transition-colors">
              Sign in instead
            </Link>
          </p>

          <form onSubmit={(event) => void submit(event)} className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Email address</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="voter@dao.xyz" className="w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-white" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Create a password</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required placeholder="Create a password" className="w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-white" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Confirm password</span>
              <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" required className="w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-white" />
            </label>

            <label className="flex items-start gap-3 text-sm text-gray-600">
              <input checked={acceptedRisk} onChange={(event) => setAcceptedRisk(event.target.checked)} type="checkbox" className="mt-1 h-4 w-4" />
              <span>I understand this is a non-custodial wallet. My private key never leaves this device, and losing my recovery phrase means losing access.</span>
            </label>

            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

            <button type="submit" disabled={submitting} className="w-full rounded-xl bg-teal-600 py-4 text-sm font-bold text-white disabled:opacity-60">
              {submitting ? "Creating wallet..." : "Create Voting Wallet"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

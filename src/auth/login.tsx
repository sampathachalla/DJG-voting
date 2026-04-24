import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { useWallet } from "../hooks/useWallet";
import { ensureFirebaseWalletSession, loginFirebaseAuthUser } from "../services/firebaseAuthService";
import { upsertFirebaseUserProfile } from "../services/firebaseUserService";
import { getLocalAccountByEmail } from "../services/storageService";
import { getMetaMaskDeepLink } from "../services/sepoliaService";

export default function Login() {
  const navigate = useNavigate();
  const { unlockInternalWallet, connectMetaMask } = useWallet();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError("");
    setWarning("");

    const account = getLocalAccountByEmail(email);

    if (!account) {
      setError("No local wallet exists for that email on this device.");
      return;
    }

    try {
      setLoading(true);
      await unlockInternalWallet(account, password, { refreshState: false });
      navigate("/dashboard");

      void loginFirebaseAuthUser(account.email, password)
        .then(async () => {
          await upsertFirebaseUserProfile({
            email: account.email,
            walletAddress: account.walletAddress,
            walletSource: "internal",
          });
        })
        .catch((firebaseError) => {
          const message = firebaseError instanceof Error ? firebaseError.message : "Firebase sign-in failed.";

          if (message === "Firebase network request failed." || message === "Firebase sign-in timed out.") {
            setWarning("Firebase Auth did not respond, but your local wallet was unlocked on this device.");
          } else {
            setError(firebaseError instanceof Error ? firebaseError.message : "Firebase sign-in failed.");
          }
        });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to unlock wallet.");
    } finally {
      setLoading(false);
    }
  };

  const loginWithMetaMask = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      setWarning("");
      const connectedWalletAddress = await connectMetaMask();
      navigate("/dashboard");

      void ensureFirebaseWalletSession()
        .then(async () => {
          await upsertFirebaseUserProfile({
            walletAddress: connectedWalletAddress,
            walletSource: "metamask",
          });
        })
        .catch((firestoreError) => {
          const message =
            firestoreError instanceof Error
              ? firestoreError.message
              : "Unable to store the MetaMask profile in Firestore.";

          setWarning(
            message === "Missing or insufficient permissions."
              ? "MetaMask connected successfully, but Firestore does not currently allow writing the wallet profile."
              : message,
          );
        });
    } catch (connectError) {
      const message = connectError instanceof Error ? connectError.message : "Unable to connect MetaMask.";

      if (message === "MetaMask is not available in this browser.") {
        window.location.href = getMetaMaskDeepLink();
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#1e1730] flex-col justify-between p-14 overflow-hidden">
        <div className="absolute top-[-120px] left-[-120px] w-[500px] h-[500px] bg-[#893ec8] rounded-full blur-[160px] opacity-30 pointer-events-none" />
        <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-teal-500 rounded-full blur-[140px] opacity-20 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <img src={logo} alt="DJG Voting Wallet" className="h-16 w-auto brightness-0 invert" />
          <span className="text-white font-black text-2xl tracking-tight">VOTING</span>
        </div>
        <div className="relative z-10">
          <h2 className="text-white text-5xl font-black leading-tight tracking-tight mb-6">
            Your vote.<br />On Sepolia.<br />For free.
          </h2>
          <p className="text-purple-200 text-lg leading-relaxed max-w-sm">
            Unlock your local wallet or connect MetaMask to create events, vote on proposals, and verify every transaction on-chain.
          </p>
        </div>
        <p className="relative z-10 text-purple-200 text-sm">Firebase Auth is used for account sign-in. Private keys still never leave your browser.</p>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-16 bg-[#faf9fd]">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#7d3bba] transition-colors">
              Back to home
            </Link>
          </div>

          <h1 className="text-3xl font-black text-[#2e2646] mb-2">Welcome back</h1>
          <p className="text-gray-500 mb-8">
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-[#7d3bba] hover:text-[#5d2b8a] transition-colors">
              Create a voting wallet
            </Link>
          </p>

          <form onSubmit={(event) => void submit(event)} className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Email address</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-white" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Password</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required className="w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-white" />
            </label>

            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {warning ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{warning}</p> : null}

            <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#8b46cd] py-4 text-sm font-bold text-white disabled:opacity-60">
              {loading ? "Signing in..." : "Unlock local wallet"}
            </button>
          </form>

          <button onClick={() => void loginWithMetaMask()} disabled={loading} className="mt-5 w-full rounded-xl border border-purple-200 bg-[#f6f2fa] py-4 text-sm font-bold text-[#893ec8] disabled:opacity-60">
            Continue with MetaMask
          </button>
          <p className="mt-3 text-center text-xs leading-6 text-gray-500">
            MetaMask handles its own unlock step. We request wallet access, then bring you back here to vote with that wallet address.
          </p>
        </div>
      </div>
    </div>
  );
}

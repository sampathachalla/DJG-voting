import { Navigate, Outlet } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

export default function ProtectedRoute() {
  const { walletAddress, isRestoringSession } = useWallet();

  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7fafa] text-[#2e2646]">
        <p className="text-sm font-semibold tracking-[0.2em] uppercase">Restoring session...</p>
      </div>
    );
  }

  if (!walletAddress) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

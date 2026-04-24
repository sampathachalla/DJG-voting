import { Link } from "react-router-dom";
import { getContractConfig } from "../../contracts/config";
import { useWallet } from "../../hooks/useWallet";

export default function DashboardPage() {
  const { activeNetwork } = useWallet();
  const contractConfig = getContractConfig(activeNetwork);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#e0eff0] px-6 py-10 text-[#2e2646] md:px-12">
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #dceef4 0%, #b8cde4 25%, #cbcae4 70%, #9fcce1 100%)",
        }}
      />
      <div className="absolute top-[-140px] left-[-220px] h-[760px] w-[760px] rounded-full bg-purple-300/70 blur-[140px] mix-blend-multiply" />
      <div className="absolute bottom-[-140px] right-[-180px] h-[560px] w-[560px] rounded-full bg-teal-200/80 blur-[120px] mix-blend-multiply" />
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(#4d5a8c 1px, transparent 1px), linear-gradient(90deg, #4d5a8c 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] border border-white/40 bg-white/35 p-8 shadow-[0_30px_80px_rgba(46,38,70,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-700">{contractConfig.networkLabel} voting dashboard</p>
              <h1 className="mt-3 text-4xl font-black text-[#2e2646] md:text-5xl">Your non-custodial voting wallet</h1>
              <p className="mt-3 text-lg text-[#463c63]">
                This app writes to {contractConfig.networkLabel}. You never pay real money. Fund the active wallet with free {contractConfig.nativeTokenSymbol} from a faucet before creating events or casting votes.
              </p>
            </div>
            <a
              href={activeNetwork === "amoy" ? "https://faucet.polygon.technology/" : "https://cloud.google.com/application/web3/faucet/ethereum/sepolia"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full bg-[#8b46cd] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-purple-600/25 transition hover:bg-[#722eaa]"
            >
              Get free {contractConfig.nativeTokenSymbol}
            </a>
          </div>
        </section>

        <div className="grid gap-6">
          <section className="rounded-[2rem] border border-white/40 bg-white/35 p-8 shadow-[0_24px_70px_rgba(46,38,70,0.12)] backdrop-blur-xl">
            <h2 className="text-2xl font-black text-[#2e2646]">Quick actions</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <ActionCard
                title="Browse events"
                description="Read every election and proposal stored in the voting contract."
                to="/events"
              />
              <ActionCard
                title="Create event"
                description={`Create a ${contractConfig.networkLabel} voting event with proposals and options for voters.`}
                to="/events/new"
              />
              <ActionCard
                title="Vote on an event"
                description="Open any active event, review the proposals, and cast your vote on-chain."
                to="/events"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <Link
      to={to}
      className="rounded-[2rem] border border-white/40 bg-[#f6f2fa]/80 p-6 transition duration-300 hover:-translate-y-1 hover:border-purple-300 hover:bg-white hover:shadow-[0_20px_50px_rgba(125,59,186,0.12)]"
    >
      <h3 className="text-xl font-black text-[#2e2646]">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-[#514769]">{description}</p>
    </Link>
  );
}

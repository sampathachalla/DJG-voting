import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getContractConfig, hasVotingContractAddress } from "../contracts/config";
import { useWallet } from "../hooks/useWallet";
import { getEventVoteCount, getEvents, getExplorerAddressUrl } from "../services";
import type { VotingEventSummary } from "../types/voting";

type EventParticipationRow = VotingEventSummary & { voteCount: number };

const participationStatus = (event: VotingEventSummary): string => {
  if (!event.isActive) {
    return "Canceled";
  }
  const now = Date.now() / 1000;
  if (now < event.startTime) {
    return "Upcoming";
  }
  if (now > event.endTime) {
    return "Ended";
  }
  return "Live";
};

type ParticipationPanelProps = {
  basePath: string;
  /** When false, hides the “Your events” stat and creator row highlights (observer mode without a wallet). */
  showCreatorInsights: boolean;
};

export function ParticipationPanel({ basePath, showCreatorInsights }: ParticipationPanelProps) {
  const { activeNetwork, walletAddress } = useWallet();
  const contractConfig = getContractConfig(activeNetwork);
  const contractReady = hasVotingContractAddress(activeNetwork);
  const [participationRows, setParticipationRows] = useState<EventParticipationRow[]>([]);
  const [participationError, setParticipationError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      if (!contractReady) {
        setParticipationRows([]);
        setParticipationError("");
        return;
      }

      try {
        const list = await getEvents(activeNetwork);
        const enriched = await Promise.all(
          list.map(async (ev) => ({
            ...ev,
            voteCount: await getEventVoteCount(ev.id, activeNetwork),
          })),
        );
        if (!cancelled) {
          setParticipationRows(enriched);
          setParticipationError("");
        }
      } catch (err) {
        if (!cancelled) {
          setParticipationError(err instanceof Error ? err.message : "Unable to load participation data.");
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeNetwork, contractReady]);

  const participationSummary = useMemo(() => {
    const totalVotes = participationRows.reduce((sum, row) => sum + row.voteCount, 0);
    const yourEvents = walletAddress
      ? participationRows.filter((row) => row.creator.toLowerCase() === walletAddress.toLowerCase())
      : [];
    return { totalVotes, yourEvents, eventCount: participationRows.length };
  }, [participationRows, walletAddress]);

  const openHref = (eventId: number): string => {
    const prefix = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
    return `${prefix}/${eventId}`;
  };

  return (
    <section className="rounded-2xl border border-white/45 bg-white/45 p-5 shadow-md shadow-[rgba(46,38,70,0.06)] backdrop-blur-xl md:p-6">
      <h2 className="text-xl font-black tracking-tight text-[#2e2646] md:text-2xl">Participation</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[#514769]">
        Vote totals come from the factory contract (<code className="rounded bg-white/60 px-1.5 py-0.5 text-xs">getEventVoteCount</code>
        ).{showCreatorInsights ? " Rows highlight events you created when a wallet is connected." : null}
      </p>

      {!contractReady ? (
        <p className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3.5 text-sm text-amber-950">
          Add the {contractConfig.networkLabel} voting contract address to your environment to load on-chain participation.
        </p>
      ) : null}

      {participationError ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50/90 p-3.5 text-sm text-red-800">{participationError}</p>
      ) : null}

      {contractReady && !participationError ? (
        <>
          <div className={`mt-4 grid gap-3 ${showCreatorInsights ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <StatTile label="Events on-chain" value={String(participationSummary.eventCount)} />
            <StatTile label="Total votes cast" value={String(participationSummary.totalVotes)} />
            {showCreatorInsights ? (
              <StatTile
                label="Your events"
                value={walletAddress ? String(participationSummary.yourEvents.length) : "—"}
                hint={walletAddress ? undefined : "Connect a wallet to see events you created."}
              />
            ) : null}
          </div>

          {participationRows.length === 0 ? (
            <p className="mt-4 text-sm text-[#514769]">No events yet on this contract.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/50 bg-[#f6f2fa]/80">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#e7e0f1] text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#6a6284]">
                  <tr>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Votes</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {participationRows.map((row) => {
                    const isYours =
                      showCreatorInsights &&
                      Boolean(walletAddress) &&
                      row.creator.toLowerCase() === walletAddress!.toLowerCase();
                    return (
                      <tr key={row.id} className="border-b border-[#ece6f5] last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#2e2646]">{row.title}</span>
                            {isYours ? (
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-purple-800">
                                You created
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-[#6a6284]">{row.description}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#463c63]">{participationStatus(row)}</td>
                        <td className="px-4 py-3 font-black text-[#2e2646]">{row.voteCount}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={openHref(row.id)}
                            className="inline-flex rounded-full border border-purple-200 bg-white px-3 py-1.5 text-xs font-bold text-[#7d3bba] transition hover:border-purple-400"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

type ParticipationEventCompactSummaryProps = {
  event: VotingEventSummary;
};

/** Compact on-chain totals for a single event (observer detail). Uses the same contract read as the full panel. */
export function ParticipationEventCompactSummary({ event }: ParticipationEventCompactSummaryProps) {
  const { activeNetwork } = useWallet();
  const contractConfig = getContractConfig(activeNetwork);
  const contractReady = hasVotingContractAddress(activeNetwork);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      if (!contractReady) {
        setVoteCount(null);
        setLoadError("");
        return;
      }
      try {
        const count = await getEventVoteCount(event.id, activeNetwork);
        if (!cancelled) {
          setVoteCount(count);
          setLoadError("");
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Unable to load vote count.");
          setVoteCount(null);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeNetwork, contractReady, event.id]);

  if (!contractReady) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3.5 text-sm text-amber-950">
        Add the {contractConfig.networkLabel} voting contract address to your environment to load on-chain vote totals.
      </div>
    );
  }

  if (loadError) {
    return <p className="mt-4 rounded-xl border border-red-200 bg-red-50/90 p-3.5 text-sm text-red-800">{loadError}</p>;
  }

  const status = participationStatus(event);

  return (
    <div className="mt-4 rounded-xl border border-white/50 bg-[#f6f2fa]/80 p-4 shadow-sm">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#6a6284]">On-chain participation</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold text-[#5c5277]">Votes recorded</p>
            <p className="mt-0.5 text-xl font-black tabular-nums text-[#2e2646] md:text-2xl">{voteCount === null ? "…" : voteCount}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#5c5277]">Ballot status</p>
            <p className="mt-0.5 text-base font-bold text-[#463c63]">{status}</p>
          </div>
        </div>
        <a
          href={getExplorerAddressUrl(contractConfig.address, activeNetwork)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 rounded-full border border-purple-200 bg-white px-3 py-1.5 text-xs font-bold text-[#7d3bba] transition hover:border-purple-400"
        >
          View voting factory on explorer
        </a>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/50 bg-white/75 p-4 shadow-sm">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#6a6284]">{label}</p>
      <p className="mt-1.5 text-2xl font-black tabular-nums text-[#2e2646] md:text-3xl">{value}</p>
      {hint ? <p className="mt-2 text-xs text-[#6a6284]">{hint}</p> : null}
    </div>
  );
}

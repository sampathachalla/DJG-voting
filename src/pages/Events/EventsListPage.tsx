import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getContractConfig, hasVotingContractAddress } from "../../contracts/config";
import { getEvents } from "../../services";
import type { VotingEventMode, VotingEventSummary } from "../../types/voting";
import { useWallet } from "../../hooks/useWallet";

type EventBucket = "ongoing" | "upcoming" | "ended";

const formatDate = (timestamp: number): string =>
  new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const getEventStatus = (event: VotingEventSummary): string => {
  const now = Math.floor(Date.now() / 1000);

  if (!event.isActive) {
    return "Canceled";
  }

  if (now < event.startTime) {
    return "Upcoming";
  }

  if (now > event.endTime) {
    return "Ended";
  }

  return "Active";
};

const getEventBucket = (event: VotingEventSummary): EventBucket => {
  const status = getEventStatus(event);

  if (status === "Active") {
    return "ongoing";
  }

  if (status === "Upcoming") {
    return "upcoming";
  }

  return "ended";
};

const getModeLabel = (mode: VotingEventMode): string => {
  if (mode === "SingleBallot") {
    return "Single ballot";
  }

  if (mode === "MultiElection") {
    return "Multi-election";
  }

  return "Proposal-based vote";
};

const getItemCountLabel = (event: VotingEventSummary): string => {
  if (event.mode === "SingleBallot") {
    return "Ballot questions";
  }

  if (event.mode === "MultiElection") {
    return "Races";
  }

  return "Proposals";
};

const bucketCopy: Record<
  EventBucket,
  {
    label: string;
    heading: string;
    description: string;
    empty: string;
  }
> = {
  ongoing: {
    label: "Ongoing",
    heading: "Ongoing events",
    description: "These events are currently live and open for voting.",
    empty: "No events are live for voting right now.",
  },
  upcoming: {
    label: "Upcoming",
    heading: "Upcoming events",
    description: "These events are scheduled and will open when their voting window begins.",
    empty: "No upcoming events are scheduled yet.",
  },
  ended: {
    label: "Ended",
    heading: "Ended and canceled history",
    description: "These events are no longer open for voting but remain visible for reference.",
    empty: "No ended or canceled events are available yet.",
  },
};

export default function EventsListPage() {
  const { activeNetwork } = useWallet();
  const contractConfig = getContractConfig(activeNetwork);
  const hasContract = hasVotingContractAddress(activeNetwork);
  const [events, setEvents] = useState<VotingEventSummary[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeBucket, setActiveBucket] = useState<EventBucket>("ongoing");

  useEffect(() => {
    const loadEvents = async (): Promise<void> => {
      try {
        setLoading(true);
        setEvents(await getEvents(activeNetwork));
        setError("");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load events.");
      } finally {
        setLoading(false);
      }
    };

    void loadEvents();
  }, [activeNetwork]);

  const ongoingEvents = events.filter((event) => getEventBucket(event) === "ongoing");
  const upcomingEvents = events.filter((event) => getEventBucket(event) === "upcoming");
  const endedEvents = events.filter((event) => getEventBucket(event) === "ended");
  const bucketEvents: Record<EventBucket, VotingEventSummary[]> = {
    ongoing: ongoingEvents,
    upcoming: upcomingEvents,
    ended: endedEvents,
  };
  const currentBucket = bucketCopy[activeBucket];

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-700">On-chain elections</p>
            <h1 className="mt-2 text-4xl font-black text-[#2e2646] md:text-5xl">Browse {contractConfig.networkLabel} voting events</h1>
          </div>
          <Link to="/events/new" className="rounded-full bg-[#8b46cd] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-purple-600/25 transition hover:bg-[#722eaa]">
            Create event
          </Link>
        </div>

        {loading ? <p className="mt-8 text-[#514769]">Loading {contractConfig.networkLabel} events...</p> : null}
        {error ? <p className="mt-8 rounded-[1.75rem] border border-red-300/50 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur-xl">{error}</p> : null}
        {!hasContract ? (
          <div className="mt-8 rounded-[2rem] border border-amber-300/50 bg-amber-50/80 p-8 text-amber-900 shadow-[0_20px_50px_rgba(120,81,19,0.08)] backdrop-blur-xl">
            <h2 className="text-xl font-black">Contract not configured yet</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-amber-800">
              Deploy the voting contract on {contractConfig.networkLabel} and set the matching contract address in your environment. Until then, this page will stay empty instead of throwing an error.
            </p>
          </div>
        ) : null}

        {!loading && !error && events.length === 0 && hasContract ? (
          <div className="mt-8 rounded-[2rem] border border-white/40 bg-white/40 p-8 text-[#514769] shadow-[0_20px_60px_rgba(46,38,70,0.08)] backdrop-blur-xl">
            No voting events exist on the configured contract yet.
          </div>
        ) : null}

        {!loading && !error && events.length > 0 ? (
          <section className="mt-8">
            <div className="rounded-[2rem] border border-white/40 bg-white/35 p-5 shadow-[0_24px_70px_rgba(46,38,70,0.10)] backdrop-blur-xl">
              <div className="flex flex-wrap gap-3">
                {(["ongoing", "upcoming", "ended"] as EventBucket[]).map((bucket) => {
                  const isActive = activeBucket === bucket;

                  return (
                    <button
                      key={bucket}
                      type="button"
                      onClick={() => setActiveBucket(bucket)}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                        isActive
                          ? "bg-[#8b46cd] text-white shadow-lg shadow-purple-600/20"
                          : "border border-purple-300 bg-white/70 text-[#7d3bba]"
                      }`}
                    >
                      {bucketCopy[bucket].label} ({bucketEvents[bucket].length})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-[#2e2646]">{currentBucket.heading}</h2>
                <p className="mt-1 text-sm text-[#5c5277]">{currentBucket.description}</p>
              </div>
              <span className="rounded-full bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5c5277]">
                {bucketEvents[activeBucket].length} events
              </span>
            </div>

            {bucketEvents[activeBucket].length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-white/40 bg-white/40 p-8 text-[#514769] shadow-[0_20px_60px_rgba(46,38,70,0.08)] backdrop-blur-xl">
                {currentBucket.empty}
              </div>
            ) : (
              <div className="mt-6 grid gap-6">
                {bucketEvents[activeBucket].map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

function EventCard({ event }: { event: VotingEventSummary }) {
  return (
    <article className="rounded-[2rem] border border-white/40 bg-white/40 p-6 shadow-[0_24px_70px_rgba(46,38,70,0.12)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              {getModeLabel(event.mode)}
            </span>
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#5c5277]">
              {event.isPublic ? "Public vote" : `Restricted vote (${event.allowedVoterCount})`}
            </span>
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#5c5277]">
              {getEventStatus(event)}
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-black text-[#2e2646]">{event.title}</h2>
          <p className="mt-2 max-w-3xl text-[#514769]">{event.description}</p>
        </div>
        <Link to={`/events/${event.id}`} className="rounded-full border border-purple-300 bg-white/70 px-4 py-2 text-sm font-bold text-[#7d3bba] transition hover:bg-white">
          Open event
        </Link>
      </div>

      <dl className="mt-6 grid gap-4 text-sm md:grid-cols-4">
        <Meta label="Creator" value={event.creator} />
        <Meta label="Starts" value={formatDate(event.startTime)} />
        <Meta label="Ends" value={formatDate(event.endTime)} />
        <Meta label={getItemCountLabel(event)} value={event.proposalCount.toString()} />
      </dl>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[#5c5277]">{label}</dt>
      <dd className="mt-1 break-all font-semibold text-[#2e2646]">{value}</dd>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#e0eff0] px-6 py-10 text-[#2e2646] md:px-12">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #dceef4 0%, #b8cde4 25%, #cbcae4 70%, #9fcce1 100%)" }} />
      <div className="absolute top-[-140px] left-[-220px] h-[760px] w-[760px] rounded-full bg-purple-300/70 blur-[140px] mix-blend-multiply" />
      <div className="absolute bottom-[-140px] right-[-180px] h-[560px] w-[560px] rounded-full bg-teal-200/80 blur-[120px] mix-blend-multiply" />
      <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "linear-gradient(#4d5a8c 1px, transparent 1px), linear-gradient(90deg, #4d5a8c 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div className="relative">{children}</div>
    </div>
  );
}

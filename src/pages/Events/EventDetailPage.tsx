import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getContractConfig } from "../../contracts/config";
import {
  canWalletVoteInEvent,
  castVote,
  createPrivateInviteBatch,
  deleteVotingEvent,
  getAllowedVoters,
  getEvent,
  getEventProposals,
  getExplorerTxUrl,
  getPrivateEventSummary,
  getVoteRecord,
  registerWalletWithInviteToken,
} from "../../services";
import { useWallet } from "../../hooks/useWallet";
import type { PrivateVotingEventSummary } from "../../services/privateVotingService";
import type { VoteRecord, VotingEventMode, VotingEventSummary, VotingProposal } from "../../types/voting";
import { getReadableBlockchainError } from "../../utils/blockchainErrors";

const formatDate = (timestamp: number): string =>
  new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const toIsoFromDatetimeLocal = (value: string): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const hasTestnetBalance = (value: string | null): boolean => (value ? Number(value) > 0 : false);

const getEventStatus = (event: VotingEventSummary): "Upcoming" | "Active" | "Ended" | "Canceled" => {
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
    return "ballot questions";
  }

  if (event.mode === "MultiElection") {
    return "races";
  }

  return "proposals";
};

const isMissingPrivateBackendRecord = (message: string): boolean =>
  message.includes("No private voting backend record exists") || message.includes("not been prepared in the backend");

export default function EventDetailPage() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const parsedEventId = Number(eventId);
  const { signer, walletAddress, walletSource, activeNetwork, isCorrectNetwork, balance, setActiveNetwork } = useWallet();
  const contractConfig = getContractConfig(activeNetwork);
  const [event, setEvent] = useState<VotingEventSummary | null>(null);
  const [proposals, setProposals] = useState<VotingProposal[]>([]);
  const [voteRecords, setVoteRecords] = useState<Record<number, VoteRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [transactionLabel, setTransactionLabel] = useState(`View latest transaction on ${contractConfig.networkLabel} explorer`);
  const [deleting, setDeleting] = useState(false);
  const [votingState, setVotingState] = useState<{ proposalId: number; optionIndex: number } | null>(null);
  const [voteElapsedSeconds, setVoteElapsedSeconds] = useState(0);
  const [canCurrentWalletVote, setCanCurrentWalletVote] = useState(true);
  const [allowedVoters, setAllowedVoters] = useState<string[]>([]);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [privateSummary, setPrivateSummary] = useState<PrivateVotingEventSummary | null>(null);
  const [inviteTokenInput, setInviteTokenInput] = useState("");
  const [registeringWallet, setRegisteringWallet] = useState(false);
  const [issuingInvites, setIssuingInvites] = useState(false);
  const [inviteCount, setInviteCount] = useState("10");
  const [inviteExpiry, setInviteExpiry] = useState("");
  const [generatedInviteTokens, setGeneratedInviteTokens] = useState<string[]>([]);

  const setupInvitesRequested = searchParams.get("setupInvites") === "1";
  const usesPrivateInviteFlow = !!event && !event.isPublic && event.allowedVoterCount === 0;

  useEffect(() => {
    if (!votingState) {
      setVoteElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setVoteElapsedSeconds(Math.max(1, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [votingState]);

  const load = useCallback(async (): Promise<void> => {
    if (!parsedEventId) {
      setError("Invalid event id.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [loadedEvent, loadedProposals] = await Promise.all([getEvent(parsedEventId, activeNetwork), getEventProposals(parsedEventId, activeNetwork)]);
      setEvent(loadedEvent);
      setProposals(loadedProposals);

      const isPrivateInviteEvent = !loadedEvent.isPublic && loadedEvent.allowedVoterCount === 0;

      if (isPrivateInviteEvent) {
        setAllowedVoters([]);

        try {
          setPrivateSummary(await getPrivateEventSummary(parsedEventId, contractConfig.address));
        } catch (privateError) {
          const message = privateError instanceof Error ? privateError.message : "Unable to load the private voting backend state.";

          if (isMissingPrivateBackendRecord(message)) {
            setPrivateSummary(null);
          } else {
            throw privateError;
          }
        }

        if (walletAddress) {
          const [allowedToVote, records] = await Promise.all([
            canWalletVoteInEvent(parsedEventId, walletAddress, activeNetwork),
            Promise.all(
              loadedProposals.map(async (proposal) => [proposal.id, await getVoteRecord(parsedEventId, proposal.id, walletAddress, activeNetwork)] as const),
            ),
          ]);
          setCanCurrentWalletVote(allowedToVote);
          setVoteRecords(Object.fromEntries(records));
        } else {
          setCanCurrentWalletVote(false);
          setVoteRecords({});
        }
      } else {
        setPrivateSummary(null);

        if (!loadedEvent.isPublic) {
          setAllowedVoters(await getAllowedVoters(parsedEventId, activeNetwork));
        } else {
          setAllowedVoters([]);
        }

        if (walletAddress) {
          const [allowedToVote, records] = await Promise.all([
            canWalletVoteInEvent(parsedEventId, walletAddress, activeNetwork),
            Promise.all(
              loadedProposals.map(async (proposal) => [proposal.id, await getVoteRecord(parsedEventId, proposal.id, walletAddress, activeNetwork)] as const),
            ),
          ]);
          setCanCurrentWalletVote(allowedToVote);
          setVoteRecords(Object.fromEntries(records));
        } else {
          setCanCurrentWalletVote(loadedEvent.isPublic);
          setVoteRecords({});
        }
      }

      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load event.");
    } finally {
      setLoading(false);
    }
  }, [activeNetwork, contractConfig.address, parsedEventId, walletAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitVote = async (proposalId: number, optionIndex: number): Promise<void> => {
    if (!event) {
      return;
    }

    if (!signer) {
      setError("Unlock a wallet before casting a vote.");
      return;
    }

    if (!isCorrectNetwork) {
      setError(`Switch to ${contractConfig.networkLabel} before voting.`);
      return;
    }

    if (!hasTestnetBalance(balance)) {
      setError(`This wallet does not have enough ${contractConfig.nativeTokenSymbol} on ${contractConfig.networkLabel} to cast a vote. Fund the connected wallet, then try again.`);
      return;
    }

    if (!canCurrentWalletVote) {
      setError("This wallet is not allowed to vote in this event.");
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      setVotingState({ proposalId, optionIndex });
      const txHash = await castVote(signer, parsedEventId, proposalId, optionIndex, activeNetwork);
      setTransactionLabel(`View vote transaction on ${contractConfig.networkLabel} explorer`);
      setTransactionHash(txHash);
      setSuccessMessage(usesPrivateInviteFlow ? "Your private-event vote has been submitted on-chain." : "");
      await load();
    } catch (voteError) {
      setError(getReadableBlockchainError(voteError, "vote", { networkLabel: contractConfig.networkLabel, nativeTokenSymbol: contractConfig.nativeTokenSymbol }));
    } finally {
      setVotingState(null);
    }
  };

  const switchToVotingNetwork = async (): Promise<void> => {
    try {
      setSwitchingNetwork(true);
      setError("");
      await setActiveNetwork(activeNetwork);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : `Unable to switch to ${contractConfig.networkLabel}.`);
    } finally {
      setSwitchingNetwork(false);
    }
  };

  const deleteEvent = async (): Promise<void> => {
    if (!event) {
      return;
    }

    if (!signer) {
      setError("Unlock a wallet before deleting an event.");
      return;
    }

    if (!isCorrectNetwork) {
      setError(`Switch to ${contractConfig.networkLabel} before deleting an event.`);
      return;
    }

    if (!hasTestnetBalance(balance)) {
      setError(`This wallet does not have enough ${contractConfig.nativeTokenSymbol} on ${contractConfig.networkLabel} to delete the event. Fund the connected wallet, then try again.`);
      return;
    }

    try {
      setDeleting(true);
      setError("");
      setSuccessMessage("");
      const txHash = await deleteVotingEvent(signer, event.id, activeNetwork);
      setTransactionLabel(`View delete transaction on ${contractConfig.networkLabel} explorer`);
      setTransactionHash(txHash);
      await load();
    } catch (deleteError) {
      setError(getReadableBlockchainError(deleteError, "delete", { networkLabel: contractConfig.networkLabel, nativeTokenSymbol: contractConfig.nativeTokenSymbol }));
    } finally {
      setDeleting(false);
    }
  };

  const registerForPrivateEvent = async (): Promise<void> => {
    if (!event || !signer || !walletAddress) {
      setError("Connect a wallet before registering for a private event.");
      return;
    }

    if (!inviteTokenInput.trim()) {
      setError("Enter an invite token to register.");
      return;
    }

    try {
      setRegisteringWallet(true);
      setError("");
      setSuccessMessage("");
      const result = await registerWalletWithInviteToken({
        eventId: event.id,
        contractAddress: contractConfig.address,
        walletAddress,
        inviteToken: inviteTokenInput.trim(),
        signer,
      });
      setInviteTokenInput("");
      setTransactionLabel(`View private voter authorization on ${contractConfig.networkLabel} explorer`);
      setTransactionHash(result.authorizationTxHash);
      setSuccessMessage(
        result.alreadyRegistered
          ? "This wallet was already registered for the private event. You can vote on-chain from this wallet."
          : "Wallet registration is complete and this wallet is now authorized on-chain for the private event.",
      );
      await load();
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : "Unable to register the wallet for this private event.");
    } finally {
      setRegisteringWallet(false);
    }
  };

  const issueInviteTokens = async (): Promise<void> => {
    if (!event || !signer || !walletAddress) {
      setError("Connect the creator wallet before issuing invite tokens.");
      return;
    }

    const parsedInviteCount = Number(inviteCount);
    if (!Number.isInteger(parsedInviteCount) || parsedInviteCount < 1 || parsedInviteCount > 500) {
      setError("Invite count must be a whole number between 1 and 500.");
      return;
    }

    try {
      setIssuingInvites(true);
      setError("");
      setSuccessMessage("");
      const result = await createPrivateInviteBatch({
        eventId: event.id,
        contractAddress: contractConfig.address,
        organizerWallet: walletAddress,
        inviteCount: parsedInviteCount,
        expiresAt: toIsoFromDatetimeLocal(inviteExpiry),
        signer,
      });
      setGeneratedInviteTokens(result.inviteTokens);
      setSuccessMessage(`Generated ${result.inviteTokens.length} private invite token${result.inviteTokens.length === 1 ? "" : "s"}. Copy them now and send them to the intended voters.`);
      await load();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to generate private invite tokens.");
    } finally {
      setIssuingInvites(false);
    }
  };

  const isCreator = !!event && !!walletAddress && event.creator.toLowerCase() === walletAddress.toLowerCase();
  const totalVotes = useMemo(
    () =>
      proposals.reduce(
        (sum, proposal) => sum + proposal.voteCounts.reduce((proposalSum, count) => proposalSum + Number(count ?? 0), 0),
        0,
      ),
    [proposals],
  );
  const canDelete = !!event && isCreator && event.isActive && totalVotes === 0;
  const eventStatus = event ? getEventStatus(event) : null;
  const canVoteNow = eventStatus === "Active";
  const isRegisteredInviteVoter = !!walletAddress && (canCurrentWalletVote || Object.values(voteRecords).some((record) => record.hasVoted));

  if (loading) {
    return <PageShell>Loading event...</PageShell>;
  }

  if (error && !event) {
    return <PageShell>{error}</PageShell>;
  }

  return (
    <PageShell>
      {event ? (
        <>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{getModeLabel(event.mode)}</span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#5c5277]">{event.proposalCount} {getItemCountLabel(event)}</span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#5c5277]">
                {event.isPublic ? "Public vote" : usesPrivateInviteFlow ? "Private invite vote" : `Restricted vote (${event.allowedVoterCount} wallets)`}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                  eventStatus === "Active"
                    ? "bg-emerald-100 text-emerald-800"
                    : eventStatus === "Upcoming"
                      ? "bg-sky-100 text-sky-800"
                      : "bg-amber-100 text-amber-800"
                }`}
              >
                {eventStatus}
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-black text-[#2e2646]">{event.title}</h1>
            <p className="mt-3 max-w-3xl text-[#514769]">{event.description}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3 text-sm">
              <Meta label="Creator" value={event.creator} />
              <Meta label="Starts" value={formatDate(event.startTime)} />
              <Meta label="Ends" value={formatDate(event.endTime)} />
            </div>
            {canDelete ? (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => void deleteEvent()}
                  disabled={deleting}
                  className="rounded-full border border-red-300 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete event before any vote is cast"}
                </button>
              </div>
            ) : null}
            {isCreator && event.isActive && totalVotes > 0 ? (
              <p className="mt-6 rounded-[1.5rem] border border-amber-300/50 bg-amber-50/80 p-4 text-sm text-amber-900 backdrop-blur-xl">
                This event can no longer be deleted because votes have already been recorded on-chain.
              </p>
            ) : null}
            {!event.isActive ? (
              <p className="mt-6 rounded-[1.5rem] border border-amber-300/50 bg-amber-50/80 p-4 text-sm text-amber-900 backdrop-blur-xl">
                This event has been canceled on-chain and can no longer accept votes.
              </p>
            ) : null}
            {eventStatus === "Upcoming" ? (
              <p className="mt-6 rounded-[1.5rem] border border-sky-300/50 bg-sky-50/80 p-4 text-sm text-sky-900 backdrop-blur-xl">
                This event has not started yet. Voting will open at {formatDate(event.startTime)}.
              </p>
            ) : null}
            {eventStatus === "Ended" ? (
              <p className="mt-6 rounded-[1.5rem] border border-amber-300/50 bg-amber-50/80 p-4 text-sm text-amber-900 backdrop-blur-xl">
                Voting for this event has ended. The results remain visible for history and verification.
              </p>
            ) : null}
            {!isCorrectNetwork && walletSource === "metamask" ? (
              <div className="mt-6 rounded-[1.5rem] border border-red-300/50 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur-xl">
                <p className="font-semibold">MetaMask is connected to a different network.</p>
                <p className="mt-1">Switch MetaMask to {contractConfig.networkLabel} to vote in this event.</p>
                <button
                  type="button"
                  onClick={() => void switchToVotingNetwork()}
                  disabled={switchingNetwork}
                  className="mt-4 rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {switchingNetwork ? `Switching to ${contractConfig.networkLabel}...` : `Switch to ${contractConfig.networkLabel}`}
                </button>
              </div>
            ) : null}
            {!event.isPublic && usesPrivateInviteFlow ? (
              <div className="mt-6 rounded-[1.5rem] border border-white/40 bg-white/70 p-4 text-sm text-[#514769] backdrop-blur-xl">
                <p className="font-semibold text-[#2e2646]">Private invited voting event</p>
                <p className="mt-2">
                  This event uses invite-token registration. The backend validates invite tokens and authorizes registered wallets on Sepolia, then each voter still casts their own on-chain vote from their wallet.
                </p>
                {isCreator ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <Meta label="Invites issued" value={String(privateSummary?.inviteCount ?? 0)} />
                      <Meta label="Invites used" value={String(privateSummary?.usedInviteCount ?? 0)} />
                      <Meta label="Registered wallets" value={String(privateSummary?.registeredWalletCount ?? 0)} />
                      <Meta label="Votes cast" value={String(totalVotes)} />
                    </div>
                    <div className={`rounded-[1.25rem] border p-4 text-sm ${setupInvitesRequested ? "border-purple-300 bg-purple-50/70" : "border-white/40 bg-[#f6f2fa]/80"}`}>
                      <p className="font-semibold text-[#2e2646]">Generate invite tokens</p>
                      <p className="mt-2 text-[#5c5277]">
                        Create one-time invite tokens and share them with the intended voters. The plain tokens are shown only once, so copy them before leaving this page.
                      </p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Invite token count">
                          <input value={inviteCount} onChange={(event) => setInviteCount(event.target.value)} className="input" inputMode="numeric" />
                        </Field>
                        <Field label="Optional token expiry">
                          <input type="datetime-local" value={inviteExpiry} onChange={(event) => setInviteExpiry(event.target.value)} className="input" />
                        </Field>
                      </div>
                      <button
                        type="button"
                        onClick={() => void issueInviteTokens()}
                        disabled={issuingInvites || !signer || !walletAddress}
                        className="mt-4 rounded-full bg-[#8b46cd] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(139,70,205,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {issuingInvites ? "Generating invite tokens..." : "Generate invite tokens"}
                      </button>
                      {generatedInviteTokens.length > 0 ? (
                        <div className="mt-4 rounded-[1.25rem] border border-white/40 bg-white/80 p-4">
                          <p className="text-sm font-semibold text-[#2e2646]">Generated invite tokens</p>
                          <textarea
                            readOnly
                            value={generatedInviteTokens.join("\n")}
                            className="input mt-3 min-h-40 font-mono text-xs"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div>
                      {walletAddress ? (
                        isRegisteredInviteVoter ? (
                          <div
                            className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-bold ${
                              canCurrentWalletVote ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {canCurrentWalletVote ? "You are registered and allowed to vote" : "You have already voted from this wallet"}
                          </div>
                        ) : (
                          <div className="inline-flex items-center rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-800">
                            Register with your invite token to vote in this event
                          </div>
                        )
                      ) : (
                        <div className="inline-flex items-center rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-800">
                          Connect a wallet to register for this private event
                        </div>
                      )}
                    </div>
                    {!isRegisteredInviteVoter ? (
                      privateSummary ? (
                        <div className="rounded-[1.25rem] border border-white/40 bg-[#f6f2fa]/80 p-4">
                          <Field label="Invite token">
                            <input
                              value={inviteTokenInput}
                              onChange={(event) => setInviteTokenInput(event.target.value)}
                              className="input"
                              placeholder="Paste the invite token from the organizer"
                            />
                          </Field>
                          <button
                            type="button"
                            onClick={() => void registerForPrivateEvent()}
                            disabled={registeringWallet || !walletAddress || !signer}
                            className="mt-4 rounded-full bg-[#8b46cd] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(139,70,205,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {registeringWallet ? "Registering wallet..." : "Register wallet with invite token"}
                          </button>
                        </div>
                      ) : (
                        <p className="rounded-[1.25rem] border border-amber-300/50 bg-amber-50/80 p-4 text-sm text-amber-900">
                          The organizer has not issued any invite tokens for this event yet.
                        </p>
                      )
                    ) : (
                      <p className="rounded-[1.25rem] border border-emerald-300/50 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                        This wallet is registered for the private event. Your vote will be sent directly to {contractConfig.networkLabel}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}
            {!event.isPublic && !usesPrivateInviteFlow ? (
              <div className="mt-6 rounded-[1.5rem] border border-white/40 bg-white/70 p-4 text-sm text-[#514769] backdrop-blur-xl">
                <p className="font-semibold text-[#2e2646]">Restricted voting event</p>
                <p className="mt-2">Only allowlisted wallets can vote in this event.</p>
                <div className="mt-4">
                  {walletAddress ? (
                    <div
                      className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-bold ${
                        canCurrentWalletVote ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {canCurrentWalletVote ? "You are allowed to vote" : "You are not allowed to vote"}
                    </div>
                  ) : (
                    <div className="inline-flex items-center rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-800">
                      Connect a wallet to check whether you can vote
                    </div>
                  )}
                </div>
                {allowedVoters.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5c5277]">Allowed wallets</p>
                    <div className="mt-2 space-y-2">
                      {allowedVoters.map((address) => (
                        <p key={address} className="break-all rounded-2xl bg-[#f6f2fa] px-3 py-2 text-sm text-[#2e2646]">
                          {address}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-8 grid gap-6">
            {proposals.map((proposal) => {
              const voteRecord = voteRecords[proposal.id];

              return (
                <article key={proposal.id} className="rounded-[2rem] border border-white/40 bg-[#f6f2fa]/80 p-6 shadow-[0_20px_50px_rgba(46,38,70,0.1)] backdrop-blur-xl">
                  <h2 className="text-2xl font-black text-[#2e2646]">{proposal.title}</h2>
                  <p className="mt-2 text-[#514769]">{proposal.description}</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {proposal.options.map((option, optionIndex) => {
                      const displayedVoteCount = proposal.voteCounts[optionIndex] ?? "0";

                      return (
                        <button
                          key={`${proposal.id}-${optionIndex}`}
                          type="button"
                          disabled={
                            voteRecord?.hasVoted ||
                            !canVoteNow ||
                            !hasTestnetBalance(balance) ||
                            !canCurrentWalletVote ||
                            !!votingState ||
                            !isCorrectNetwork
                          }
                          onClick={() => void submitVote(proposal.id, optionIndex)}
                          className="rounded-[1.5rem] border border-white/40 bg-white/70 p-5 text-left transition hover:-translate-y-1 hover:border-purple-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <p className="font-bold text-[#2e2646]">{option}</p>
                          <p className="mt-2 text-sm text-[#514769]">Votes: {displayedVoteCount}</p>
                          {votingState?.proposalId === proposal.id && votingState.optionIndex === optionIndex ? (
                            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[#7d3bba]">
                              Submitting vote... {voteElapsedSeconds}s
                            </p>
                          ) : null}
                          {voteRecord?.optionIndex === optionIndex ? <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[#7d3bba]">Your recorded vote</p> : null}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>

          {votingState ? (
            <p className="mt-6 rounded-[1.5rem] border border-purple-200/60 bg-white/70 p-4 text-sm text-[#5c5277] backdrop-blur-xl">
              Sending your vote to {contractConfig.networkLabel}. Elapsed time:{" "}
              <span className="font-bold text-[#2e2646]">{voteElapsedSeconds}s</span>
            </p>
          ) : null}

          {transactionHash ? (
            <a href={getExplorerTxUrl(transactionHash, activeNetwork)} target="_blank" rel="noreferrer" className="mt-6 inline-block text-sm font-semibold text-[#7d3bba] underline">
              {transactionLabel}
            </a>
          ) : null}
          {successMessage ? <p className="mt-6 rounded-[1.5rem] border border-emerald-300/50 bg-emerald-50/80 p-4 text-sm text-emerald-800 backdrop-blur-xl">{successMessage}</p> : null}
          {error ? <p className="mt-6 rounded-[1.5rem] border border-red-300/50 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur-xl">{error}</p> : null}
        </>
      ) : null}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#e0eff0] px-6 py-10 text-[#2e2646] md:px-12">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #dceef4 0%, #b8cde4 25%, #cbcae4 70%, #9fcce1 100%)" }} />
      <div className="absolute top-[-140px] left-[-220px] h-[760px] w-[760px] rounded-full bg-purple-300/70 blur-[140px] mix-blend-multiply" />
      <div className="absolute bottom-[-140px] right-[-180px] h-[560px] w-[560px] rounded-full bg-teal-200/80 blur-[120px] mix-blend-multiply" />
      <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "linear-gradient(#4d5a8c 1px, transparent 1px), linear-gradient(90deg, #4d5a8c 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div className="relative mx-auto max-w-6xl">{children}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[#5c5277]">{label}</p>
      <p className="mt-1 break-all font-semibold text-[#2e2646]">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <p className="mb-2 text-sm font-semibold text-[#514769]">{label}</p>
      {children}
    </label>
  );
}

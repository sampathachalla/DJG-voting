import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { FiTrash2 } from "react-icons/fi";
import { getContractConfig, hasVotingContractAddress } from "../../contracts/config";
import { createVotingEvent, getEventCreationFee, getExplorerTxUrl, upsertFirebaseContractRecord, upsertFirebaseEventRecord } from "../../services";
import { useWallet } from "../../hooks/useWallet";
import type { CreateEventInput, CreateProposalInput, VotingEventMode } from "../../types/voting";
import { getReadableBlockchainError } from "../../utils/blockchainErrors";
import { formatTokenAmount } from "../../utils/formatAmount";

const eventModes: VotingEventMode[] = ["SingleBallot", "MultiElection", "ProposalBased"];

const modeContent: Record<
  VotingEventMode,
  {
    label: string;
    summary: string;
    eventTitlePlaceholder: string;
    eventDescriptionPlaceholder: string;
    proposalSectionTitle: string;
    proposalSectionDescription: string;
    proposalTitleHint: string;
    proposalTitlePlaceholder: string;
    proposalDescriptionPlaceholder: string;
    optionLabel: string;
    optionPlaceholder: (index: number) => string;
  }
> = {
  SingleBallot: {
    label: "Single ballot",
    summary: "Use this for one ballot question, one office, or one yes-or-no matter within a single voting event.",
    eventTitlePlaceholder: "Student council president election",
    eventDescriptionPlaceholder: "A single-ballot election to choose the next student council president.",
    proposalSectionTitle: "Ballot question",
    proposalSectionDescription: "For a single-ballot event, create one proposal that represents the race or ballot question voters will answer.",
    proposalTitleHint: "Use this title for the ballot question, office, or seat being decided.",
    proposalTitlePlaceholder: "Who should serve as student council president?",
    proposalDescriptionPlaceholder: "List the office, election rules, or the exact ballot wording.",
    optionLabel: "Ballot option",
    optionPlaceholder: (index) => (index === 0 ? "Candidate or choice 1" : index === 1 ? "Candidate or choice 2" : `Candidate or choice ${index + 1}`),
  },
  MultiElection: {
    label: "Multi-election",
    summary: "Use this when one event contains several races or offices, such as president, secretary, and treasurer in the same election.",
    eventTitlePlaceholder: "Student council general election",
    eventDescriptionPlaceholder: "One election event containing separate races for multiple offices.",
    proposalSectionTitle: "Race or office",
    proposalSectionDescription: "Each proposal represents a separate race, seat, or office. Add one proposal for every office voters need to decide.",
    proposalTitleHint: "Use the proposal title for the office or contest name.",
    proposalTitlePlaceholder: "President",
    proposalDescriptionPlaceholder: "Describe the office, seat, or eligibility rules for this race.",
    optionLabel: "Candidate",
    optionPlaceholder: (index) => `Candidate ${index + 1}`,
  },
  ProposalBased: {
    label: "Proposal-based vote",
    summary: "Use this for motions, resolutions, policy changes, or referendums where voters review and approve separate proposals.",
    eventTitlePlaceholder: "Annual member resolutions vote",
    eventDescriptionPlaceholder: "A proposal-based vote covering several motions and policy questions.",
    proposalSectionTitle: "Proposal or measure",
    proposalSectionDescription: "Each proposal represents a motion, resolution, referendum, or policy measure that voters will approve, reject, or rank.",
    proposalTitleHint: "Use the proposal title for the resolution, motion, or measure name.",
    proposalTitlePlaceholder: "Approve the 2026 member budget",
    proposalDescriptionPlaceholder: "Summarize the policy measure or include the formal proposal wording.",
    optionLabel: "Vote choice",
    optionPlaceholder: (index) => (index === 0 ? "Yes" : index === 1 ? "No" : `Choice ${index + 1}`),
  },
};

const getProposalTitleLabel = (mode: VotingEventMode, index: number): string => {
  if (mode === "SingleBallot") {
    return `Ballot question ${index + 1} title`;
  }

  if (mode === "MultiElection") {
    return `Race or office ${index + 1} title`;
  }

  return `Proposal or measure ${index + 1} title`;
};

const getDefaultProposalTitle = (mode: VotingEventMode, index: number): string => {
  if (mode === "SingleBallot") {
    return `Ballot question ${index}`;
  }

  if (mode === "MultiElection") {
    return `Race ${index}`;
  }

  return `Proposal ${index}`;
};

const getDefaultOptionLabel = (mode: VotingEventMode, index: number): string => {
  if (mode === "SingleBallot") {
    return index === 1 ? "Yes" : index === 2 ? "No" : `Choice ${index}`;
  }

  if (mode === "MultiElection") {
    return `Candidate ${index}`;
  }

  return index === 1 ? "Yes" : index === 2 ? "No" : `Choice ${index}`;
};

const toTimestamp = (value: string): number => Math.floor(new Date(value).getTime() / 1000);
const hasTestnetBalance = (value: string | null): boolean => (value ? Number(value) > 0 : false);

export default function EventCreatePage() {
  const navigate = useNavigate();
  const { signer, email, walletAddress, activeNetwork, isCorrectNetwork, balance } = useWallet();
  const contractConfig = getContractConfig(activeNetwork);
  const hasContract = hasVotingContractAddress(activeNetwork);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<VotingEventMode>("SingleBallot");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [restrictedAccessMode, setRestrictedAccessMode] = useState<"walletAllowlist" | "inviteTokens">("inviteTokens");
  const [allowedWalletsInput, setAllowedWalletsInput] = useState("");
  const [proposals, setProposals] = useState<CreateProposalInput[]>([
    { title: getDefaultProposalTitle("SingleBallot", 1), description: "", options: ["Yes", "No"] },
  ]);
  const [fee, setFee] = useState<string>("0");
  const [error, setError] = useState("");
  const [indexingWarning, setIndexingWarning] = useState("");
  const [successHash, setSuccessHash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitElapsedSeconds, setSubmitElapsedSeconds] = useState(0);
  const modeCopy = modeContent[mode];

  useEffect(() => {
    void getEventCreationFee(activeNetwork)
      .then(setFee)
      .catch(() => setFee("0"));
  }, [activeNetwork]);

  useEffect(() => {
    if (!submitting) {
      setSubmitElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setSubmitElapsedSeconds(Math.max(1, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [submitting]);

  const updateProposal = (index: number, nextProposal: CreateProposalInput): void => {
    setProposals((current) => current.map((proposal, proposalIndex) => (proposalIndex === index ? nextProposal : proposal)));
  };

  const addProposal = (): void => {
    setProposals((current) => [
      ...current,
      {
        title: getDefaultProposalTitle(mode, current.length + 1),
        description: "",
        options: [getDefaultOptionLabel(mode, 1), getDefaultOptionLabel(mode, 2)],
      },
    ]);
  };

  const removeProposal = (index: number): void => {
    setProposals((current) => current.filter((_, proposalIndex) => proposalIndex !== index));
  };

  const removeProposalOption = (proposalIndex: number, optionIndex: number): void => {
    setProposals((current) =>
      current.map((proposal, currentProposalIndex) =>
        currentProposalIndex === proposalIndex
          ? {
              ...proposal,
              options: proposal.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex),
            }
          : proposal,
      ),
    );
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError("");
    setIndexingWarning("");
    setSuccessHash("");

    if (!signer) {
      setError("Unlock an internal wallet or connect MetaMask before creating an event.");
      return;
    }

    if (!isCorrectNetwork) {
      setError(`Switch to ${contractConfig.networkLabel} before creating an event.`);
      return;
    }

    if (!hasTestnetBalance(balance)) {
      setError(`This wallet does not have enough ${contractConfig.nativeTokenSymbol} on ${contractConfig.networkLabel} to create an event. Fund the connected wallet, then try again.`);
      return;
    }

    if (!startAt || !endAt || toTimestamp(endAt) <= toTimestamp(startAt)) {
      setError("Set a valid start and end time.");
      return;
    }

    const normalizedProposals = proposals.map((proposal) => ({
      ...proposal,
      title: proposal.title.trim(),
      description: proposal.description.trim(),
      options: proposal.options.map((option) => option.trim()).filter(Boolean),
    }));

    const allowedVoters = Array.from(
      new Set(
        allowedWalletsInput
          .split(/[\n,]/)
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => entry.toLowerCase()),
      ),
    );
    const usePrivateInviteFlow = !isPublic && restrictedAccessMode === "inviteTokens";

    if (normalizedProposals.some((proposal) => !proposal.title || proposal.options.length < 2)) {
      setError("Every proposal needs a title and at least two options.");
      return;
    }

    if (!isPublic && !usePrivateInviteFlow && allowedVoters.length === 0) {
      setError("Restricted events need at least one allowed wallet address.");
      return;
    }

    if (!isPublic && !usePrivateInviteFlow && allowedVoters.some((address) => !ethers.isAddress(address))) {
      setError("One or more allowed wallet addresses are invalid.");
      return;
    }

    const input: CreateEventInput = {
      title: title.trim(),
      description: description.trim(),
      mode,
      startTime: toTimestamp(startAt),
      endTime: toTimestamp(endAt),
      isPublic,
      allowedVoters: usePrivateInviteFlow ? [] : allowedVoters,
      proposals: normalizedProposals,
    };

    try {
      setSubmitting(true);
      const result = await createVotingEvent(signer, input, activeNetwork);
      setSuccessHash(result.txHash);

      if (contractConfig.address) {
        try {
          await upsertFirebaseContractRecord({
            network: activeNetwork,
            networkLabel: contractConfig.networkLabel,
            contractAddress: contractConfig.address,
            status: "active",
          });

          if (result.eventId !== null && walletAddress) {
            const now = Math.floor(Date.now() / 1000);
            const eventStatus =
              now < input.startTime ? "upcoming" : now > input.endTime ? "ended" : "active";

            await upsertFirebaseEventRecord({
              network: activeNetwork,
              networkLabel: contractConfig.networkLabel,
              contractAddress: contractConfig.address,
              eventId: result.eventId,
              title: input.title,
              description: input.description,
              creatorWalletAddress: walletAddress,
              creatorEmail: email ?? undefined,
              mode: input.mode,
              isPublic: input.isPublic,
              allowedVoterCount: input.allowedVoters.length,
              proposalCount: input.proposals.length,
              startTime: input.startTime,
              endTime: input.endTime,
              transactionHash: result.txHash,
              status: eventStatus,
            });
          }
        } catch (firebaseError) {
          console.warn("Firebase indexing failed after event creation.", firebaseError);
          setIndexingWarning("The event was created on-chain, but Firebase indexing did not complete. Check your Firestore rules or sign-in state if you need the metadata stored there.");
        }
      }

      navigate(usePrivateInviteFlow && result.eventId ? `/events/${result.eventId}?setupInvites=1` : "/events");
    } catch (submitError) {
      setError(
        getReadableBlockchainError(submitError, "create", {
          networkLabel: contractConfig.networkLabel,
          nativeTokenSymbol: contractConfig.nativeTokenSymbol,
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-black text-[#2e2646] md:text-5xl">Create a {contractConfig.networkLabel} voting event</h1>
        <p className="mt-3 text-[#514769]">
          Creation fee: {fee === "0" ? `No event fee on ${contractConfig.networkLabel}` : `${formatTokenAmount(fee)} ${contractConfig.nativeTokenSymbol}`} | Wallet balance: {balance ? `${formatTokenAmount(balance)} ${contractConfig.nativeTokenSymbol}` : "unknown"}
        </p>
        {hasContract && !hasTestnetBalance(balance) ? (
          <div className="mt-6 rounded-[2rem] border border-amber-300/50 bg-amber-50/80 p-6 text-amber-900 shadow-[0_20px_50px_rgba(120,81,19,0.08)] backdrop-blur-xl">
            This wallet has no {contractConfig.nativeTokenSymbol} yet. Fund the wallet connected inside the app before creating an event.
          </div>
        ) : null}
        {!hasContract ? (
          <div className="mt-6 rounded-[2rem] border border-amber-300/50 bg-amber-50/80 p-6 text-amber-900 shadow-[0_20px_50px_rgba(120,81,19,0.08)] backdrop-blur-xl">
            Deploy the voting contract for {contractConfig.networkLabel} first, then set the matching contract address in <code>.env</code> to enable event creation.
          </div>
        ) : null}

        <form onSubmit={(event) => void submit(event)} className="mt-8 space-y-6 rounded-[2rem] border border-white/40 bg-white/40 p-8 shadow-[0_24px_70px_rgba(46,38,70,0.12)] backdrop-blur-xl">
          <Field label="Event title">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="input"
              placeholder={modeCopy.eventTitlePlaceholder}
              required
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="input min-h-28"
              placeholder={modeCopy.eventDescriptionPlaceholder}
              required
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Mode">
              <select value={mode} onChange={(event) => setMode(event.target.value as VotingEventMode)} className="input">
                {eventModes.map((eventMode) => (
                  <option key={eventMode} value={eventMode}>
                    {modeContent[eventMode].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start date">
              <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="input" required />
            </Field>
            <Field label="End date">
              <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="input" required />
            </Field>
          </div>

          <div className="rounded-[1.75rem] border border-white/40 bg-[#f6f2fa]/80 p-5 shadow-[0_14px_40px_rgba(46,38,70,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1599c1]">{modeCopy.label}</p>
            <p className="mt-3 text-sm leading-6 text-[#5c5277]">{modeCopy.summary}</p>
          </div>

          <div className="rounded-[1.75rem] border border-white/40 bg-[#f6f2fa]/80 p-5 shadow-[0_14px_40px_rgba(46,38,70,0.08)]">
            <p className="text-sm font-semibold text-[#514769]">Who can vote?</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  isPublic ? "bg-[#8b46cd] text-white shadow-lg shadow-purple-600/20" : "border border-purple-300 bg-white/70 text-[#7d3bba]"
                }`}
              >
                Anyone can vote
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  !isPublic ? "bg-[#8b46cd] text-white shadow-lg shadow-purple-600/20" : "border border-purple-300 bg-white/70 text-[#7d3bba]"
                }`}
              >
                Specific wallets only
              </button>
            </div>
            {!isPublic ? (
              <div className="mt-5">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setRestrictedAccessMode("inviteTokens")}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      restrictedAccessMode === "inviteTokens" ? "bg-[#8b46cd] text-white shadow-lg shadow-purple-600/20" : "border border-purple-300 bg-white/70 text-[#7d3bba]"
                    }`}
                  >
                    Private invite tokens
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestrictedAccessMode("walletAllowlist")}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      restrictedAccessMode === "walletAllowlist" ? "bg-[#8b46cd] text-white shadow-lg shadow-purple-600/20" : "border border-purple-300 bg-white/70 text-[#7d3bba]"
                    }`}
                  >
                    Wallet allowlist
                  </button>
                </div>
                {restrictedAccessMode === "walletAllowlist" ? (
                  <>
                    <Field label="Allowed wallet addresses">
                      <textarea
                        value={allowedWalletsInput}
                        onChange={(event) => setAllowedWalletsInput(event.target.value)}
                        className="input min-h-32"
                        placeholder={"0x1234...\n0xabcd...\n0x9876..."}
                        required={!isPublic && restrictedAccessMode === "walletAllowlist"}
                      />
                    </Field>
                    <p className="mt-2 text-sm text-[#5c5277]">Enter one address per line or separate them with commas.</p>
                  </>
                ) : (
                  <div className="mt-4 rounded-[1.5rem] border border-white/40 bg-white/70 p-4 text-sm text-[#5c5277]">
                    This restricted event will use the private invite backend. After the event is created on Sepolia, you will generate invite tokens from the event detail page and share them with voters.
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#5c5277]">Anyone using this shared contract can vote during the event window.</p>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.75rem] border border-white/40 bg-[#f6f2fa]/80 p-5 shadow-[0_14px_40px_rgba(46,38,70,0.08)]">
              <p className="text-sm font-semibold text-[#514769]">{modeCopy.proposalSectionTitle}</p>
              <p className="mt-2 text-sm leading-6 text-[#5c5277]">{modeCopy.proposalSectionDescription}</p>
            </div>

            {proposals.map((proposal, index) => (
              <div key={index} className="rounded-[1.75rem] border border-white/40 bg-[#f6f2fa]/80 p-5 shadow-[0_14px_40px_rgba(46,38,70,0.08)]">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6a6284]">
                    {mode === "SingleBallot"
                      ? `Ballot question ${index + 1}`
                      : mode === "MultiElection"
                        ? `Race or office ${index + 1}`
                        : `Proposal or measure ${index + 1}`}
                  </p>
                  {proposals.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeProposal(index)}
                      className="rounded-full border border-red-300 bg-white/70 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={getProposalTitleLabel(mode, index)}>
                    <>
                      <input
                        value={proposal.title}
                        onChange={(event) => updateProposal(index, { ...proposal, title: event.target.value })}
                        className="input"
                        placeholder={modeCopy.proposalTitlePlaceholder}
                        required
                      />
                      <p className="mt-2 text-sm text-[#5c5277]">{modeCopy.proposalTitleHint}</p>
                    </>
                  </Field>
                  <Field label="Description">
                    <input
                      value={proposal.description}
                      onChange={(event) => updateProposal(index, { ...proposal, description: event.target.value })}
                      className="input"
                      placeholder={modeCopy.proposalDescriptionPlaceholder}
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {proposal.options.map((option, optionIndex) => (
                    <Field key={optionIndex} label={`${modeCopy.optionLabel} ${optionIndex + 1}`}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={option}
                            onChange={(event) =>
                              updateProposal(index, {
                                ...proposal,
                                options: proposal.options.map((entry, entryIndex) =>
                                  entryIndex === optionIndex ? event.target.value : entry,
                                ),
                              })
                            }
                            className="input flex-1"
                            placeholder={modeCopy.optionPlaceholder(optionIndex)}
                            required
                          />
                          {proposal.options.length > 2 ? (
                            <button
                              type="button"
                              onClick={() => removeProposalOption(index, optionIndex)}
                              aria-label={`Delete ${modeCopy.optionLabel.toLowerCase()} ${optionIndex + 1}`}
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-200 bg-white/80 text-lg font-black text-red-500 transition hover:border-red-300 hover:bg-red-50"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                        {proposal.options.length > 2 ? (
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-500/80">
                            Remove this {modeCopy.optionLabel.toLowerCase()}
                          </p>
                        ) : null}
                      </div>
                    </Field>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateProposal(index, {
                      ...proposal,
                      options: [...proposal.options, getDefaultOptionLabel(mode, proposal.options.length + 1)],
                    })
                  }
                  className="mt-4 rounded-full border border-purple-300 bg-white/70 px-4 py-2 text-sm font-bold text-[#7d3bba] transition hover:bg-white"
                >
                  Add {modeCopy.optionLabel.toLowerCase()}
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            <button type="button" onClick={addProposal} className="rounded-full border border-purple-300 bg-white/70 px-5 py-3 text-sm font-bold text-[#7d3bba] transition hover:bg-white">
              {mode === "SingleBallot" ? "Add ballot question" : mode === "MultiElection" ? "Add race or office" : "Add proposal or measure"}
            </button>
            <button
              type="submit"
              disabled={submitting || !hasContract || !hasTestnetBalance(balance)}
              className="rounded-full bg-[#8b46cd] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-purple-600/25 disabled:opacity-60"
            >
              {submitting ? `Submitting... ${submitElapsedSeconds}s` : `Create on ${contractConfig.networkLabel}`}
            </button>
          </div>

          {submitting ? (
            <p className="text-sm font-medium text-[#5c5277]">
              Sending your event to {contractConfig.networkLabel}. This usually takes a few seconds on Sepolia. Elapsed time:{" "}
              <span className="font-bold text-[#2e2646]">{submitElapsedSeconds}s</span>
            </p>
          ) : null}

          {error ? <p className="rounded-[1.5rem] border border-red-300/50 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur-xl">{error}</p> : null}
          {indexingWarning ? <p className="rounded-[1.5rem] border border-amber-300/50 bg-amber-50/80 p-4 text-sm text-amber-900 backdrop-blur-xl">{indexingWarning}</p> : null}
          {successHash ? (
            <a href={getExplorerTxUrl(successHash, activeNetwork)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#7d3bba] underline">
              View transaction on {contractConfig.networkLabel} explorer
            </a>
          ) : null}
        </form>
      </div>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[#514769]">{label}</span>
      {children}
    </label>
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

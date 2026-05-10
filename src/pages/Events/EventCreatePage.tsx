import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { FiTrash2 } from "react-icons/fi";
import { getContractConfig, hasVotingContractAddress } from "../../contracts/config";
import { createVotingEvent, getEventCreationFee, getExplorerTxUrl, upsertFirebaseContractRecord, upsertFirebaseEventRecord } from "../../services";
import { useWallet } from "../../hooks/useWallet";
import type { CreateEventInput, CreateProposalInput, VotingEventMode } from "../../types/voting";
import { getReadableBlockchainError } from "../../utils/blockchainErrors";
import { formatTokenAmount } from "../../utils/formatAmount";

const CREATE_EVENT_FORM_ID = "create-event-form";

const eventModes: VotingEventMode[] = ["SingleBallot", "MultiElection", "ProposalBased"];

type StepId = "basics" | "schedule" | "access" | "ballot" | "review";

const STEP_IDS: StepId[] = ["basics", "schedule", "access", "ballot", "review"];

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

function parseAllowedWallets(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
    ),
  );
}

function isBasicsComplete(title: string, description: string): boolean {
  return Boolean(title.trim() && description.trim());
}

function isScheduleComplete(startAt: string, endAt: string): boolean {
  if (!startAt || !endAt) {
    return false;
  }
  return toTimestamp(endAt) > toTimestamp(startAt);
}

function isAccessComplete(
  isPublic: boolean,
  restrictedAccessMode: "walletAllowlist" | "inviteTokens",
  allowedWalletsInput: string,
): boolean {
  if (isPublic) {
    return true;
  }
  if (restrictedAccessMode === "inviteTokens") {
    return true;
  }
  const wallets = parseAllowedWallets(allowedWalletsInput);
  return wallets.length > 0 && wallets.every((address) => ethers.isAddress(address));
}

function isProposalsComplete(proposals: CreateProposalInput[]): boolean {
  return proposals.every((proposal) => {
    const options = proposal.options.map((option) => option.trim()).filter(Boolean);
    return Boolean(proposal.title.trim()) && options.length >= 2;
  });
}

export default function EventCreatePage() {
  const navigate = useNavigate();
  const { signer, email, walletAddress, activeNetwork, isCorrectNetwork, balance, setActiveNetwork, walletSource } = useWallet();
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
  const [activeStepId, setActiveStepId] = useState<StepId>("basics");
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const wizardColumnRef = useRef<HTMLFormElement>(null);
  const skipScrollIntoViewRef = useRef(true);
  const modeCopy = modeContent[mode];

  const stepIndex = STEP_IDS.indexOf(activeStepId);
  const isFirstStep = stepIndex <= 0;
  const isReviewStep = activeStepId === "review";

  const needsBrowserNetworkSwitch =
    Boolean(signer && walletAddress && !isCorrectNetwork && (walletSource === "metamask" || walletSource === "coinbase"));

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

  const goToPreviousStep = (): void => {
    if (!isFirstStep) {
      setActiveStepId(STEP_IDS[stepIndex - 1]);
    }
  };

  const goToNextStep = (): void => {
    if (!isReviewStep && stepIndex < STEP_IDS.length - 1) {
      setActiveStepId(STEP_IDS[stepIndex + 1]);
    }
  };

  const basicsDone = isBasicsComplete(title, description);
  const scheduleDone = isScheduleComplete(startAt, endAt);
  const accessDone = isAccessComplete(isPublic, restrictedAccessMode, allowedWalletsInput);
  const proposalsDone = isProposalsComplete(proposals);
  const reviewReady = basicsDone && scheduleDone && accessDone && proposalsDone;

  const steps: Array<{ id: StepId; label: string; complete: boolean; optional?: boolean }> = [
    { id: "basics", label: "Event basics", complete: basicsDone },
    { id: "schedule", label: "Schedule & voting mode", complete: scheduleDone },
    { id: "access", label: "Access", complete: accessDone },
    { id: "ballot", label: `Ballot / ${modeCopy.proposalSectionTitle.toLowerCase()}`, complete: proposalsDone },
    { id: "review", label: "Review", complete: reviewReady, optional: true },
  ];

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

  useEffect(() => {
    if (skipScrollIntoViewRef.current) {
      skipScrollIntoViewRef.current = false;
      return;
    }
    wizardColumnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeStepId]);

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
      setError("Unlock an internal wallet or connect MetaMask / Coinbase Wallet before creating an event.");
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

    const allowedVoters = parseAllowedWallets(allowedWalletsInput);
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

      navigate(
        usePrivateInviteFlow && result.eventId
          ? `/organize/events/${result.eventId}?setupInvites=1`
          : "/observe",
      );
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

  const renderStepContent = (): React.ReactNode => {
    switch (activeStepId) {
      case "basics":
        return (
          <StepPanel title="Event basics" description="Give voters a clear name and short overview so they understand what they are voting on.">
            <div className="space-y-5">
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
            </div>
          </StepPanel>
        );

      case "schedule":
        return (
          <StepPanel title="Schedule & voting mode" description="Choose the voting mode and the window during which voters can submit ballots.">
            <div className="space-y-5">
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

              <div className="rounded-xl border border-white/35 bg-white/30 p-4 shadow-sm backdrop-blur-sm md:p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1599c1]">{modeCopy.label}</p>
                <p className="mt-3 text-sm leading-6 text-[#5c5277]">{modeCopy.summary}</p>
              </div>
            </div>
          </StepPanel>
        );

      case "access":
        return (
          <StepPanel title="Access — who can vote" description="Pick public voting or restrict participation to a known list of wallets.">
            <div className="rounded-xl border border-white/35 bg-white/30 p-4 shadow-sm backdrop-blur-sm md:p-5">
              <p className="text-sm font-semibold text-[#514769]">Who can vote?</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    isPublic ? "bg-[#8b46cd] text-white shadow-sm shadow-purple-600/15" : "border border-purple-300 bg-white/75 text-[#7d3bba]"
                  }`}
                >
                  Anyone can vote
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    !isPublic ? "bg-[#8b46cd] text-white shadow-sm shadow-purple-600/15" : "border border-purple-300 bg-white/75 text-[#7d3bba]"
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
                        restrictedAccessMode === "inviteTokens" ? "bg-[#8b46cd] text-white shadow-sm shadow-purple-600/15" : "border border-purple-300 bg-white/75 text-[#7d3bba]"
                      }`}
                    >
                      Private invite tokens
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestrictedAccessMode("walletAllowlist")}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                        restrictedAccessMode === "walletAllowlist" ? "bg-[#8b46cd] text-white shadow-sm shadow-purple-600/15" : "border border-purple-300 bg-white/75 text-[#7d3bba]"
                      }`}
                    >
                      Wallet allowlist
                    </button>
                  </div>
                  {restrictedAccessMode === "walletAllowlist" ? (
                    <>
                      <div className="mt-4">
                        <Field label="Allowed wallet addresses">
                          <textarea
                            value={allowedWalletsInput}
                            onChange={(event) => setAllowedWalletsInput(event.target.value)}
                            className="input min-h-32"
                            placeholder={"0x1234...\n0xabcd...\n0x9876..."}
                            required={!isPublic && restrictedAccessMode === "walletAllowlist"}
                          />
                        </Field>
                      </div>
                      <p className="mt-2 text-sm text-[#5c5277]">Enter one address per line or separate them with commas.</p>
                    </>
                  ) : (
                    <div className="mt-4 rounded-xl border border-white/45 bg-white/75 p-3.5 text-sm text-[#5c5277]">
                      This restricted event will use the private invite backend. After the event is created on Sepolia, you will generate invite tokens from the event detail page and share them with voters.
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#5c5277]">Anyone using this shared contract can vote during the event window.</p>
              )}
            </div>
          </StepPanel>
        );

      case "ballot":
        return (
          <StepPanel title={`Ballot / ${modeCopy.proposalSectionTitle.toLowerCase()}`} description={modeCopy.proposalSectionDescription}>
            <div className="space-y-4">
              <div className="rounded-xl border border-white/35 bg-white/30 p-4 shadow-sm backdrop-blur-sm md:p-5">
                <p className="text-sm font-semibold text-[#514769]">{modeCopy.proposalSectionTitle}</p>
                <p className="mt-2 text-sm leading-6 text-[#5c5277]">{modeCopy.proposalSectionDescription}</p>
              </div>

              <div className="space-y-3">
                {proposals.map((proposal, index) => (
                  <ProposalDisclosure
                    key={index}
                    mode={mode}
                    modeCopy={modeCopy}
                    index={index}
                    proposal={proposal}
                    proposalsLength={proposals.length}
                    onUpdate={(next) => updateProposal(index, next)}
                    onRemove={() => removeProposal(index)}
                    onRemoveOption={(optionIndex) => removeProposalOption(index, optionIndex)}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={addProposal}
                className="rounded-full border border-purple-300 bg-white/70 px-5 py-3 text-sm font-bold text-[#7d3bba] transition hover:bg-white"
              >
                {mode === "SingleBallot" ? "Add ballot question" : mode === "MultiElection" ? "Add race or office" : "Add proposal or measure"}
              </button>
            </div>
          </StepPanel>
        );

      case "review":
        return (
          <StepPanel title="Review" description="Double-check the highlights, then create the event on-chain using the button below.">
            <div className="space-y-3 text-sm leading-6 text-[#5c5277]">
              <p>
                <span className="font-semibold text-[#514769]">Title:</span> {title.trim() || <em className="text-[#6a6284]">Not set</em>}
              </p>
              <p>
                <span className="font-semibold text-[#514769]">Mode:</span> {modeCopy.label}
              </p>
              <p>
                <span className="font-semibold text-[#514769]">Schedule:</span>{" "}
                {startAt && endAt ? `${new Date(startAt).toLocaleString()} → ${new Date(endAt).toLocaleString()}` : <em className="text-[#6a6284]">Not scheduled yet</em>}
              </p>
              <p>
                <span className="font-semibold text-[#514769]">Visibility:</span> {isPublic ? "Public" : restrictedAccessMode === "inviteTokens" ? "Restricted (invite tokens)" : "Restricted (wallet allowlist)"}
              </p>
              <p>
                <span className="font-semibold text-[#514769]">Ballots:</span> {proposals.length} {proposals.length === 1 ? "item" : "items"}
              </p>
              {!reviewReady ? (
                <div className="rounded-xl border border-amber-300/50 bg-amber-50/80 p-3 text-sm text-amber-900">
                  Some required steps are still incomplete. Use the sidebar to revisit any step marked “Required”.
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-300/50 bg-emerald-50/80 p-3 text-sm text-emerald-800">
                  All required steps look complete. Use Create on {contractConfig.networkLabel} below to submit.
                </div>
              )}
            </div>
          </StepPanel>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl pb-10 pt-1 md:pb-12 md:pt-2">
      <h1 className="text-3xl font-black tracking-tight text-[#1e1730] drop-shadow-sm md:text-4xl">Create a {contractConfig.networkLabel} voting event</h1>
      {isReviewStep ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            form={CREATE_EVENT_FORM_ID}
            disabled={submitting || !hasContract || !hasTestnetBalance(balance) || needsBrowserNetworkSwitch}
            className="rounded-full bg-[#8b46cd] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-purple-600/20 disabled:opacity-60"
          >
            {submitting ? `Submitting... ${submitElapsedSeconds}s` : `Create on ${contractConfig.networkLabel}`}
          </button>
        </div>
      ) : null}
      <p className="mt-2 text-sm text-[#514769] md:text-base">
        Creation fee: {fee === "0" ? `No event fee on ${contractConfig.networkLabel}` : `${formatTokenAmount(fee)} ${contractConfig.nativeTokenSymbol}`} | Wallet balance:{" "}
        {balance ? `${formatTokenAmount(balance)} ${contractConfig.nativeTokenSymbol}` : "unknown"}
      </p>
      {hasContract && !hasTestnetBalance(balance) ? (
        <div className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-50/85 p-4 text-sm text-amber-900 shadow-sm backdrop-blur-md md:p-5">
          This wallet has no {contractConfig.nativeTokenSymbol} yet. Fund the wallet connected inside the app before creating an event.
        </div>
      ) : null}
      {!hasContract ? (
        <div className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-50/85 p-4 text-sm text-amber-900 shadow-sm backdrop-blur-md md:p-5">
          Deploy the voting contract for {contractConfig.networkLabel} first, then set the matching contract address in <code>.env</code> to enable event creation.
        </div>
      ) : null}
      {needsBrowserNetworkSwitch ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-300/60 bg-red-50/90 p-4 text-sm text-red-800 shadow-sm backdrop-blur-md md:flex-row md:items-center md:justify-between md:p-5">
          <p className="font-medium">
            Your {walletSource === "metamask" ? "MetaMask" : "Coinbase"} wallet is on the wrong network. Switch to{" "}
            <strong>{contractConfig.networkLabel}</strong> to create an event.
          </p>
          <button
            type="button"
            onClick={() => void switchToVotingNetwork()}
            disabled={switchingNetwork}
            className="shrink-0 rounded-full border border-red-400 bg-white px-5 py-2.5 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
          >
            {switchingNetwork ? "Switching…" : `Switch to ${contractConfig.networkLabel}`}
          </button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-start">
        <StepSidebar steps={steps} activeStepId={activeStepId} onSelect={setActiveStepId} />

        <form
          ref={wizardColumnRef}
          id={CREATE_EVENT_FORM_ID}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="min-w-0 flex-1 space-y-5"
        >
          {renderStepContent()}

          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={goToPreviousStep}
              disabled={isFirstStep}
              className="rounded-full border border-purple-300 bg-white/75 px-5 py-2.5 text-sm font-bold text-[#7d3bba] shadow-sm transition hover:bg-white disabled:opacity-60"
            >
              Back
            </button>
            {isReviewStep ? (
              <button
                type="submit"
                form={CREATE_EVENT_FORM_ID}
                disabled={submitting || !hasContract || !hasTestnetBalance(balance) || needsBrowserNetworkSwitch}
                className="rounded-full bg-[#8b46cd] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-purple-600/20 disabled:opacity-60"
              >
                {submitting ? `Submitting... ${submitElapsedSeconds}s` : `Create on ${contractConfig.networkLabel}`}
              </button>
            ) : (
              <button
                type="button"
                onClick={goToNextStep}
                className="rounded-full bg-[#8b46cd] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-purple-600/20"
              >
                Next
              </button>
            )}
          </div>

          <div className="space-y-3" aria-live="polite">
            {submitting ? (
              <p className="text-sm font-medium text-[#5c5277]">
                Sending your event to {contractConfig.networkLabel}. This usually takes a few seconds on Sepolia. Elapsed time:{" "}
                <span className="font-bold text-[#2e2646]">{submitElapsedSeconds}s</span>
              </p>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-red-300/50 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur-xl">
                <p>{error}</p>
                {needsBrowserNetworkSwitch ? (
                  <button
                    type="button"
                    onClick={() => void switchToVotingNetwork()}
                    disabled={switchingNetwork}
                    className="mt-3 rounded-full border border-red-400 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {switchingNetwork ? "Switching…" : `Switch to ${contractConfig.networkLabel}`}
                  </button>
                ) : null}
              </div>
            ) : null}
            {indexingWarning ? <p className="rounded-xl border border-amber-300/50 bg-amber-50/80 p-4 text-sm text-amber-900 backdrop-blur-xl">{indexingWarning}</p> : null}
            {successHash ? (
              <a href={getExplorerTxUrl(successHash, activeNetwork)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#7d3bba] underline">
                View transaction on {contractConfig.networkLabel} explorer
              </a>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function StepSidebar({
  steps,
  activeStepId,
  onSelect,
}: {
  steps: Array<{ id: StepId; label: string; complete: boolean; optional?: boolean }>;
  activeStepId: StepId;
  onSelect: (id: StepId) => void;
}) {
  return (
    <nav
      aria-label="Event creation steps"
      className="md:sticky md:top-2 md:w-60 md:shrink-0 lg:w-64"
    >
      <ol className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible md:pb-0">
        {steps.map((step, index) => {
          const active = step.id === activeStepId;
          const badgeText = step.optional ? "Optional" : step.complete ? "Done" : "Required";
          const badgeClass = step.optional
            ? "text-[#6a6284]"
            : step.complete
              ? "text-emerald-700"
              : "text-[#1599c1]";
          const numberClass = active
            ? "bg-[#8b46cd] text-white"
            : step.complete
              ? "bg-emerald-100 text-emerald-700"
              : "bg-white/70 text-[#7d3bba]";

          return (
            <li key={step.id} className="md:w-full">
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={active ? "step" : undefined}
                className={`flex w-full min-w-[14rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition md:min-w-0 ${
                  active
                    ? "border-[#8b46cd] bg-white/75 shadow-sm shadow-purple-600/10 ring-1 ring-[#8b46cd]/30"
                    : "border-white/40 bg-white/30 hover:border-purple-200 hover:bg-white/55"
                }`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${numberClass}`}>
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#1e1730]">{step.label}</span>
                  <span className={`mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.14em] ${badgeClass}`}>
                    {badgeText}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-white/40 bg-white/30 p-5 shadow-sm shadow-[rgba(46,38,70,0.04)] backdrop-blur-md md:p-7"
    >
      <header className="mb-5">
        <h2 className="text-xl font-bold tracking-tight text-[#1e1730] drop-shadow-sm md:text-2xl">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-[#5c5277]">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function ProposalDisclosure({
  mode,
  modeCopy,
  index,
  proposal,
  proposalsLength,
  onUpdate,
  onRemove,
  onRemoveOption,
}: {
  mode: VotingEventMode;
  modeCopy: (typeof modeContent)[VotingEventMode];
  index: number;
  proposal: CreateProposalInput;
  proposalsLength: number;
  onUpdate: (next: CreateProposalInput) => void;
  onRemove: () => void;
  onRemoveOption: (optionIndex: number) => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const heading =
    mode === "SingleBallot" ? `Ballot question ${index + 1}` : mode === "MultiElection" ? `Race or office ${index + 1}` : `Proposal or measure ${index + 1}`;
  const summaryLine = proposal.title.trim() || heading;
  const optionsOk = proposal.options.map((o) => o.trim()).filter(Boolean).length >= 2 && Boolean(proposal.title.trim());

  return (
    <details
      className="group rounded-xl border border-white/35 bg-white/30 backdrop-blur-sm open:bg-white/40"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:content-none md:px-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[#2e2646]">{summaryLine}</span>
          <span className="mt-0.5 block text-xs font-medium text-[#6a6284]">{heading}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {optionsOk ? (
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 sm:inline">Done</span>
          ) : (
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1599c1] sm:inline">Required</span>
          )}
          <span
            className="grid h-7 w-7 place-items-center rounded-full border border-white/55 bg-white/70 text-[#6a6284] transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      </summary>
      <div className="border-t border-white/35 px-3 pb-4 pt-3 md:px-4">
        <div className="mb-4 flex items-center justify-end gap-4">
          {proposalsLength > 1 ? (
            <button
              type="button"
              onClick={onRemove}
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
                onChange={(event) => onUpdate({ ...proposal, title: event.target.value })}
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
              onChange={(event) => onUpdate({ ...proposal, description: event.target.value })}
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
                      onUpdate({
                        ...proposal,
                        options: proposal.options.map((entry, entryIndex) => (entryIndex === optionIndex ? event.target.value : entry)),
                      })
                    }
                    className="input flex-1"
                    placeholder={modeCopy.optionPlaceholder(optionIndex)}
                    required
                  />
                  {proposal.options.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveOption(optionIndex)}
                      aria-label={`Delete ${modeCopy.optionLabel.toLowerCase()} ${optionIndex + 1}`}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-200 bg-white/80 text-lg font-black text-red-500 transition hover:border-red-300 hover:bg-red-50"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                {proposal.options.length > 2 ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-500/80">Remove this {modeCopy.optionLabel.toLowerCase()}</p>
                ) : null}
              </div>
            </Field>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            onUpdate({
              ...proposal,
              options: [...proposal.options, getDefaultOptionLabel(mode, proposal.options.length + 1)],
            })
          }
          className="mt-4 rounded-full border border-purple-300 bg-white/70 px-4 py-2 text-sm font-bold text-[#7d3bba] transition hover:bg-white"
        >
          Add {modeCopy.optionLabel.toLowerCase()}
        </button>
      </div>
    </details>
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

export const getReadableBlockchainError = (
  error: unknown,
  action: "create" | "vote" | "delete",
  options?: { networkLabel?: string; nativeTokenSymbol?: string },
): string => {
  const networkLabel = options?.networkLabel ?? "the selected testnet";
  const nativeTokenSymbol = options?.nativeTokenSymbol ?? "test tokens";

  if (!(error instanceof Error)) {
    return getFallbackMessage(action);
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("insufficient funds") ||
    message.includes("intrinsic transaction cost") ||
    message.includes("code=insufficient_funds")
  ) {
    return `This wallet does not have enough ${nativeTokenSymbol} on ${networkLabel} to ${action === "create" ? "create the event" : action === "vote" ? "cast the vote" : "delete the event"}. Fund the wallet connected inside the app, then try again.`;
  }

  if (message.includes("user rejected") || message.includes("action_rejected") || message.includes("rejected")) {
    return "The transaction was canceled in the wallet.";
  }

  if (message.includes("already voted")) {
    return "This wallet has already voted on this ballot item.";
  }

  if (message.includes("voting ended")) {
    return "Voting for this event has already ended.";
  }

  if (message.includes("voting not started")) {
    return "Voting has not started yet for this event.";
  }

  if (message.includes("event canceled")) {
    return "This event has been canceled and cannot accept votes.";
  }

  if (message.includes("not allowed to vote")) {
    return "This wallet is not allowed to vote in this event.";
  }

  if (message.includes("event already started")) {
    return "This event has already started, so it can no longer be deleted under the current contract rules.";
  }

  return error.message;
};

const getFallbackMessage = (action: "create" | "vote" | "delete"): string => {
  if (action === "create") {
    return "Failed to create event.";
  }

  if (action === "vote") {
    return "Vote failed.";
  }

  return "Unable to delete this event.";
};

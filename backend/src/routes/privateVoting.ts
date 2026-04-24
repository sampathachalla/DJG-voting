import { type NextFunction, type Request, type Response, Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors.js";
import {
  createPrivateInvites,
  getPrivateEventResults,
  getPrivateEventSummary,
  getPrivateVoteTokenStatus,
  registerWalletForPrivateEvent,
  submitAnonymousVote,
} from "../services/privateVotingService.js";

const router = Router();

const createInvitesSchema = z.object({
  eventId: z.number().int().positive(),
  contractAddress: z.string().min(1),
  organizerWallet: z.string().min(1),
  inviteCount: z.number().int().min(1).max(500),
  expiresAt: z.string().datetime().optional().nullable(),
  signature: z.string().min(1),
});

const registerSchema = z.object({
  eventId: z.number().int().positive(),
  contractAddress: z.string().min(1),
  walletAddress: z.string().min(1),
  inviteToken: z.string().min(1),
  signature: z.string().min(1),
});

const voteSchema = z.object({
  eventId: z.number().int().positive(),
  contractAddress: z.string().min(1),
  voteToken: z.string().min(1),
  proposalId: z.number().int().positive(),
  optionIndex: z.number().int().nonnegative(),
});

const voteTokenStatusSchema = z.object({
  eventId: z.number().int().positive(),
  contractAddress: z.string().min(1),
  voteToken: z.string().min(1),
});

router.post("/private-events/invites", async (request, response, next) => {
  try {
    const payload = createInvitesSchema.parse(request.body);
    const result = await createPrivateInvites(payload);
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/private-events/register", async (request, response, next) => {
  try {
    const payload = registerSchema.parse(request.body);
    const result = await registerWalletForPrivateEvent(payload);
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/private-events/vote", async (request, response, next) => {
  try {
    const payload = voteSchema.parse(request.body);
    const result = await submitAnonymousVote(payload);
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/private-events/token-status", async (request, response, next) => {
  try {
    const payload = voteTokenStatusSchema.parse(request.body);
    const result = await getPrivateVoteTokenStatus(payload.contractAddress, payload.eventId, payload.voteToken);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/private-events/:eventId", async (request, response, next) => {
  try {
    const eventId = Number(request.params.eventId);
    const contractAddress = z.string().min(1).parse(request.query.contractAddress);
    const summary = await getPrivateEventSummary(contractAddress, eventId);
    response.json(summary);
  } catch (error) {
    next(error);
  }
});

router.get("/private-events/:eventId/results", async (request, response, next) => {
  try {
    const eventId = Number(request.params.eventId);
    const contractAddress = z.string().min(1).parse(request.query.contractAddress);
    const results = await getPrivateEventResults(contractAddress, eventId);
    response.json(results);
  } catch (error) {
    next(error);
  }
});

router.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
  void next;

  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: "Invalid request payload.",
      details: error.flatten(),
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected backend error.";
  response.status(500).json({ error: message });
});

export { router as privateVotingRouter };

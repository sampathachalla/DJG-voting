import { type NextFunction, type Request, type Response, Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors.js";
import {
  createPrivateInvites,
  getPrivateEventSummary,
  registerWalletForPrivateEvent,
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

router.get("/private-events/:eventId", async (request, response, next) => {
  try {
    const eventIdRaw = request.params.eventId;
    if (!/^\d+$/.test(eventIdRaw) || eventIdRaw.length > 20) {
      throw new HttpError(400, "eventId must be a non-negative integer.");
    }
    const eventId = Number(eventIdRaw);
    if (!Number.isSafeInteger(eventId) || eventId < 0) {
      throw new HttpError(400, "eventId is out of range.");
    }
    const contractAddress = z.string().min(1).parse(request.query.contractAddress);
    const summary = await getPrivateEventSummary(contractAddress, eventId);
    response.json(summary);
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
  if (process.env.NODE_ENV !== "production") {
    console.error("[privateVoting]", error);
  }
  response.status(500).json({ error: message });
});

export { router as privateVotingRouter };

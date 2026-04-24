import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  BACKEND_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  SEPOLIA_RPC_URL: z.string().min(1, "SEPOLIA_RPC_URL is required."),
  BACKEND_RELAYER_PRIVATE_KEY: z.string().min(1, "BACKEND_RELAYER_PRIVATE_KEY is required."),
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required."),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, "FIREBASE_CLIENT_EMAIL is required."),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required."),
});

const parsed = schema.parse(process.env);

export const backendConfig = {
  port: parsed.PORT,
  allowedOrigins: parsed.BACKEND_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  sepoliaRpcUrl: parsed.SEPOLIA_RPC_URL,
  relayerPrivateKey: parsed.BACKEND_RELAYER_PRIVATE_KEY,
  firebaseProjectId: parsed.FIREBASE_PROJECT_ID,
  firebaseClientEmail: parsed.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: parsed.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
};

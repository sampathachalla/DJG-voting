import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDotenv({ path: path.resolve(__dirname, "../.env") });
loadDotenv({ path: path.resolve(__dirname, "../../.env"), override: false });

const schema = z.object({
  PORT: z.coerce.number().default(8081),
  BACKEND_ALLOWED_ORIGINS: z
    .string()
    .default(
      [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
      ].join(","),
    ),
  SEPOLIA_RPC_URL: z.string().optional(),
  VITE_SEPOLIA_RPC_URL: z.string().optional(),
  BACKEND_RELAYER_PRIVATE_KEY: z.string().optional(),
  DEPLOYER_PRIVATE_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
});

const parsed = schema.parse(process.env);
const resolvedSepoliaRpcUrl = (parsed.SEPOLIA_RPC_URL ?? parsed.VITE_SEPOLIA_RPC_URL ?? "").trim();
const resolvedRelayerPrivateKey = (parsed.BACKEND_RELAYER_PRIVATE_KEY ?? parsed.DEPLOYER_PRIVATE_KEY ?? "").trim();

export const backendConfig = {
  port: parsed.PORT,
  allowedOrigins: parsed.BACKEND_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  sepoliaRpcUrl: resolvedSepoliaRpcUrl,
  relayerPrivateKey: resolvedRelayerPrivateKey,
  firebaseProjectId: parsed.FIREBASE_PROJECT_ID ?? "",
  firebaseClientEmail: parsed.FIREBASE_CLIENT_EMAIL ?? "",
  firebasePrivateKey: parsed.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "",
  privateVotingStorageMode:
    parsed.FIREBASE_PROJECT_ID && parsed.FIREBASE_CLIENT_EMAIL && parsed.FIREBASE_PRIVATE_KEY ? "firestore" : "file",
};

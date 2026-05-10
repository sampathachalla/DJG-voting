import cors from "cors";
import express from "express";
import helmet from "helmet";
import { backendConfig } from "./config.js";
import { privateVotingRouter } from "./routes/privateVoting.js";

const isLocalDevOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:")
    );
  } catch {
    return false;
  }
};

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (backendConfig.allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      network: "sepolia",
      storageMode: backendConfig.privateVotingStorageMode,
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api", privateVotingRouter);

  return app;
};

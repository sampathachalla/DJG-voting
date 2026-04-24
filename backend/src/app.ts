import cors from "cors";
import express from "express";
import helmet from "helmet";
import { backendConfig } from "./config.js";
import { privateVotingRouter } from "./routes/privateVoting.js";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: backendConfig.allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      network: "sepolia",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api", privateVotingRouter);

  return app;
};

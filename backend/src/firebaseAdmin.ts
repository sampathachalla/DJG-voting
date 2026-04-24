import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { backendConfig } from "./config.js";

const app =
  getApps()[0] ??
  initializeApp({
    credential:
      process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? applicationDefault()
        : cert({
            projectId: backendConfig.firebaseProjectId,
            clientEmail: backendConfig.firebaseClientEmail,
            privateKey: backendConfig.firebasePrivateKey,
          }),
  });

export const firestore = getFirestore(app);

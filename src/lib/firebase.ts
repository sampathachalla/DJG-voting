import { initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import type { FirebaseEnvConfig } from "../types/firebase";

let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let firebaseAppInstance: ReturnType<typeof initializeApp> | null = null;

const fallbackFirebaseConfig: FirebaseEnvConfig = {
  apiKey: "AIzaSyCxiPyOREy_JFPs1EtwfwM-yneUevsjH00",
  authDomain: "mood-bytes.firebaseapp.com",
  projectId: "mood-bytes",
  storageBucket: "mood-bytes.firebasestorage.app",
  messagingSenderId: "523876416367",
  appId: "1:523876416367:web:7c36d96d903a6b396d869a",
};

const getFirebaseConfig = (): FirebaseEnvConfig => {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? fallbackFirebaseConfig.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? fallbackFirebaseConfig.authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? fallbackFirebaseConfig.projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? fallbackFirebaseConfig.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? fallbackFirebaseConfig.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? fallbackFirebaseConfig.appId,
  };

  const missingEntry = Object.entries(config).find(([, value]) => !value);

  if (missingEntry) {
    throw new Error(`Firebase is not configured. Missing ${missingEntry[0]}.`);
  }

  return config as FirebaseEnvConfig;
};

export const isFirebaseConfigured = (): boolean => {
  try {
    getFirebaseConfig();
    return true;
  } catch {
    return false;
  }
};

export const getFirestoreDb = (): Firestore => {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  const app = firebaseAppInstance ?? initializeApp(getFirebaseConfig());
  firebaseAppInstance = app;
  firestoreInstance = getFirestore(app);
  return firestoreInstance;
};

export const getFirebaseAuth = (): Auth => {
  if (authInstance) {
    return authInstance;
  }

  const app = firebaseAppInstance ?? initializeApp(getFirebaseConfig());
  firebaseAppInstance = app;
  authInstance = getAuth(app);
  return authInstance;
};

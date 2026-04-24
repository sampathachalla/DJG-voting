import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase";

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const normalizeFirebaseAuthError = (error: unknown, fallback: string): Error => {
  if (!(error instanceof Error)) {
    return new Error(fallback);
  }

  const code = (error as Error & { code?: string }).code;

  switch (code) {
    case "auth/email-already-in-use":
      return new Error("A Firebase user already exists for this email.");
    case "auth/invalid-email":
      return new Error("The email address is not valid.");
    case "auth/weak-password":
      return new Error("Firebase rejected the password. Use a stronger password.");
    case "auth/network-request-failed":
      return new Error("Firebase network request failed.");
    case "auth/operation-not-allowed":
      return new Error("Firebase anonymous auth is not enabled for wallet sign-in.");
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return new Error("Invalid email or password.");
    default:
      return error;
  }
};

export const registerFirebaseAuthUser = async (
  email: string,
  password: string,
  walletAddress: string,
): Promise<void> => {
  try {
    const auth = getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: walletAddress });
  } catch (error) {
    throw normalizeFirebaseAuthError(error, "Unable to create the Firebase user.");
  }
};

export const loginFirebaseAuthUser = async (email: string, password: string): Promise<void> => {
  try {
    const auth = getFirebaseAuth();
    await withTimeout(
      signInWithEmailAndPassword(auth, email, password),
      8000,
      "Firebase sign-in timed out.",
    );
  } catch (error) {
    throw normalizeFirebaseAuthError(error, "Unable to sign in with Firebase.");
  }
};

export const ensureFirebaseWalletSession = async (): Promise<void> => {
  try {
    const auth = getFirebaseAuth();

    if (auth.currentUser) {
      return;
    }

    await withTimeout(
      signInAnonymously(auth),
      8000,
      "Firebase anonymous sign-in timed out.",
    );
  } catch (error) {
    throw normalizeFirebaseAuthError(error, "Unable to create a Firebase wallet session.");
  }
};

export const logoutFirebaseAuthUser = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  await signOut(auth);
};

export const deleteCurrentFirebaseAuthUser = async (): Promise<void> => {
  const auth = getFirebaseAuth();

  if (!auth.currentUser) {
    return;
  }

  try {
    await deleteUser(auth.currentUser);
  } catch (error) {
    const code = (error as Error & { code?: string }).code;

    if (code === "auth/requires-recent-login") {
      throw new Error("Firebase requires a fresh login before deleting this account.");
    }

    throw normalizeFirebaseAuthError(error, "Unable to delete the Firebase account.");
  }
};

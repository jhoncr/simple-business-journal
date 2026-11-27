// import firebase from 'firebase/app';
"use client";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  connectAuthEmulator,
  signInWithRedirect,
  User,
} from "firebase/auth";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from "react";
import {
  CustomProvider,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";
const isDev = process.env.NODE_ENV === "development";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (isDev ? "demo-key" : undefined),
  authDomain: isDev
    ? "demo-dummy.firebaseapp.com"
    : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: isDev
    ? process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_PROJECT_ID || "demo-dummy"
    : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: isDev
    ? "demo-dummy.appspot.com"
    : process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const emulatorIP =
  process.env.NEXT_PUBLIC_EMULATOR_IP || "localhost";

export const app = initializeApp(firebaseConfig);

export const functions = getFunctions(app);

if (process.env.NODE_ENV === "development") {
  connectAuthEmulator(getAuth(), `http://${emulatorIP}:9099`, {
    disableWarnings: true,
  });

  connectFunctionsEmulator(functions, emulatorIP, 5001);

  // connect to firebase storage emulator
  connectStorageEmulator(getStorage(app), emulatorIP, 9199);
}

// Initialize App Check directly after Firebase app setup and emulator connections,
// but only on the client side.
if (typeof window !== "undefined") {
  if (process.env.NODE_ENV === "development") {
    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: () => {
          return Promise.resolve({
            token: "fake-token",
            expireTimeMillis: Date.now() + 1000 * 60 * 60 * 24, // 1 day
          });
        },
      }),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (recaptchaSiteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      console.warn(
        "NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not configured; skipping App Check initialization.",
      );
    }
  }
}

export const useFirebaseAuth = () => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    setAuthUser(null);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await getAuth(app).signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
      throw error;
    } finally {
      clear();
    }
  }, [clear]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(getAuth(app), provider);
    } catch (error) {
      console.error("Failed to sign in with Google:", error);
      throw error;
    }
  }, []);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
      setAuthUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return useMemo(
    () => ({
      authUser,
      loading,
      signOut,
      signInWithGoogle,
    }),
    [authUser, loading, signOut, signInWithGoogle],
  );
};

interface AuthUserContextType {
  authUser: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const authUserContext = createContext<AuthUserContextType>({
  authUser: null,
  loading: true,
  signOut: async () => {},
  signInWithGoogle: async () => {},
});

// create and export a provider
export function AuthUserProvider({ children }: { children: React.ReactNode }) {
  const auth = useFirebaseAuth();

  return (
    <authUserContext.Provider value={auth}>
      {children}
    </authUserContext.Provider>
  );
}

// create and export a hook to use the authUserContext
export const useAuth = () => useContext(authUserContext);

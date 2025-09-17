// import firebase from 'firebase/app';
"use client";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  connectAuthEmulator,
  signInWithRedirect,
  User,
} from "firebase/auth";
import { useState, useEffect, createContext, useContext } from "react";
import {
  CustomProvider,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const emulatorIP =
  process.env.NEXT_PUBLIC_EMULATOR_IP || "localhost";

export const app = initializeApp(firebaseConfig);

export const functions = getFunctions(app);

if (process.env.NODE_ENV === "development") {
  console.log(
    `node_env: ${process.env.NODE_ENV} -- hitting local auth and firestore emulators`,
  );
  console.log("testing locally -- hitting local auth and firestore emulators");
  connectAuthEmulator(getAuth(), `http://${emulatorIP}:9099`, {
    disableWarnings: true,
  });

  connectFunctionsEmulator(functions, emulatorIP, 5001);
}

// Initialize App Check directly after Firebase app setup and emulator connections,
// but only on the client side.
if (typeof window !== "undefined") {
  // The console.log("window loaded") was part of window.onload,
  // it's removed as App Check now initializes sooner.
  // If specific logging for App Check init is needed, it can be added here.
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
    console.log("App Check initialized with CustomProvider for development.");
  } else {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(
        process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!,
      ),
      isTokenAutoRefreshEnabled: true,
    });
    console.log("App Check initialized with ReCaptchaEnterpriseProvider for production.");
  }
}

export const useFirebaseAuth = () => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  const clear = () => {
    setAuthUser(null);
    setLoading(false);
  };

  const signOut = () => auth.signOut().then(clear);

  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
    // signInWithRedirect(auth, provider);
  };

  const handleAuthStateChanged = (user: User | null) => {
    if (user) {
      setAuthUser(user);
    } else {
      setAuthUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(handleAuthStateChanged);
    return () => unsubscribe();
  }, [auth]);

  return {
    authUser,
    loading,
    signOut,
    signInWithGoogle,
  };
};

const authUserContext = createContext({
  authUser: null as User | null,
  loading: true,
  signOut: () => {},
  signInWithGoogle: () => {},
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

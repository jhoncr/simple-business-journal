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
// import the config.json file
import devConfig from "./config.dev.json";
import prodConfig from "./config.json";

const config = process.env.NODE_ENV === "development" ? devConfig : prodConfig;

const firebaseConfig = config.firebaseConfig;

export const app = initializeApp(firebaseConfig);

export const functions = getFunctions(app);

if (process.env.NODE_ENV === "development") {
  console.log(
    `node_env: ${process.env.NODE_ENV} -- hitting local auth and firestore emulators`,
  );
  console.log("testing locally -- hitting local auth and firestore emulators");
  connectAuthEmulator(getAuth(), "http://localhost:9099", {
    disableWarnings: true,
  });

  connectFunctionsEmulator(functions, "localhost", 5001);
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
      provider: new ReCaptchaEnterpriseProvider(config.recaptchaSiteKey),
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
  }, []);

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

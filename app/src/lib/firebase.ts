import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

/**
 * Firebase Diagnostic Helper
 */
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
};

// 1. Initial Identity Check
const missingEnvVars = Object.entries(firebaseConfig)
    .filter(([, value]) => !value || value === "undefined")
    .map(([key]) => key);

if (missingEnvVars.length > 0) {
    console.error(`DIAGNOSTIC: Missing Firebase config values: ${missingEnvVars.join(", ")}`);
}

// 2. Singleton Initialization with Protection
let app: FirebaseApp;
try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} catch (err: any) {
    console.error("Firebase Auth Init Failed:", err?.message ?? err);
    if (getApps().length) {
        app = getApp();
    } else {
        // When Firebase cannot initialize, create a placeholder object to avoid module failure.
        app = {} as FirebaseApp;
    }
}

// 3. Service Extraction with Extreme Safety
const auth: Auth = (() => {
    try {
        return getAuth(app);
    } catch (e: any) {
        console.warn("🛡️ Auth Service Offline:", e?.message ?? e);
        return {} as Auth; // Type-safe placeholder
    }
})();

export { app, auth };

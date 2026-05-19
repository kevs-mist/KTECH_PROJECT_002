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
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "undefined") {
    console.error("DIAGNOSTIC: Firebase API Key is MISSING or UNDEFINED in .env.local.");
}

// 2. Singleton Initialization with Protection
let app: FirebaseApp;
try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} catch (err: any) {
    console.error("Firebase Auth Init Failed:", err.message);
    // Fallback app to prevent total crash
    app = getApp(); 
}

// 3. Service Extraction with Extreme Safety
const auth: Auth = (() => {
    try {
        return getAuth(app);
    } catch (e: any) {
        console.warn("🛡️ Auth Service Offline:", e.message);
        return {} as Auth; // Type-safe placeholder
    }
})();

export { app, auth };

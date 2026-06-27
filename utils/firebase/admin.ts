import * as admin from "firebase-admin";

let authInstance: admin.auth.Auth | null = null;

function getAuth(): admin.auth.Auth {
    if (authInstance) return authInstance;

    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    const missingVars = [
        !privateKey && "FIREBASE_PRIVATE_KEY",
        !clientEmail && "FIREBASE_CLIENT_EMAIL",
        !projectId && "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    ].filter(Boolean);

    if (missingVars.length > 0) {
        throw new Error(`Missing Firebase Admin environment variables: ${missingVars.join(", ")}`);
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }

    authInstance = admin.auth();
    return authInstance;
}

// Proxy adminAuth to defer initialization until a method is actually invoked at runtime.
// This prevents compile/build-time errors in environments like CI/CD where these environment variables are not set.
export const adminAuth = new Proxy({} as admin.auth.Auth, {
    get(target, prop) {
        const authObj = getAuth();
        const value = Reflect.get(authObj, prop);
        if (typeof value === "function") {
            return value.bind(authObj);
        }
        return value;
    }
});

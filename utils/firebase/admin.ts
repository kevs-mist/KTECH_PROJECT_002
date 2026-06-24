// @ts-nocheck - Firebase Admin v14 has TypeScript issues
const admin = require("firebase-admin");

let adminAuthInstance: any = null;

export function getAdminAuth() {
    if (adminAuthInstance) {
        return adminAuthInstance;
    }

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

    try {
        if (!admin.apps || admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
        }

        adminAuthInstance = admin.auth();
        return adminAuthInstance;
    } catch (error) {
        console.error("Firebase Admin initialization error:", error);
        throw new Error(`Failed to initialize Firebase Admin: ${error instanceof Error ? error.message : String(error)}`);
    }
}

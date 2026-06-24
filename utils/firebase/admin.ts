import * as admin from "firebase-admin";

let adminAuthInstance: admin.auth.Auth | null = null;

function getAdminAuth() {
    if (adminAuthInstance) {
        return adminAuthInstance;
    }

    if (!admin.apps.length) {
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
}

export const adminAuth = getAdminAuth();

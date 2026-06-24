// @ts-ignore - Firebase Admin SDK has TypeScript issues in v14
import admin from "firebase-admin";

let adminAuthInstance: any = null;

function getAdminAuth() {
    if (adminAuthInstance) {
        return adminAuthInstance;
    }

    // @ts-ignore
    if (!admin.apps?.length) {
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

        // @ts-ignore
        admin.initializeApp({
            // @ts-ignore
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }

    // @ts-ignore
    adminAuthInstance = admin.auth();
    return adminAuthInstance;
}

export const adminAuth = getAdminAuth();

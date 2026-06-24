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

    // Lazy load firebase-admin only when needed
    try {
        const admin = require("firebase-admin");

        if (!admin.apps?.length) {
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
        throw new Error(`Failed to initialize Firebase Admin: ${error instanceof Error ? error.message : String(error)}`);
    }
}

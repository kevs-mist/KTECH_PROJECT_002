import admin from "firebase-admin";

if (!(admin as any).apps?.length) {
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
        credential: (admin as any).credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });
}

export const adminAuth = (admin as any).auth();

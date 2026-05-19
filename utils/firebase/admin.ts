import * as admin from "firebase-admin";

if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (privateKey && clientEmail && projectId) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    } else {
        // Fallback for environment where we might not have the full cert yet
        // This will allow the app to boot but token verification will fail
        // with a clear error if attempted.
        if (process.env.NODE_ENV === 'production') {
             console.error("Firebase Admin missing credentials in production!");
        }
        admin.initializeApp();
    }
}

export const adminAuth = admin.auth();

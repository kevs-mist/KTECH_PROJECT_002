/**
 * Environment Validation
 * Ensures critical keys are present before the app attempts to use them.
 */
const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
];

if (typeof window === 'undefined') {
    // Server-side check
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`FATAL: Missing required environment variable: ${envVar}`);
        }
    }
}
export {};

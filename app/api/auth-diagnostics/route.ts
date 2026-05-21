import { NextResponse } from "next/server";
import { createAdminClient } from "../../../utils/supabase/admin";
import { adminAuth } from "../../../utils/firebase/admin";

function getBearerToken(request: Request) {
    const authHeader = request.headers.get("authorization");
    return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function getEnvStatus() {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    return {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasFirebaseProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        hasFirebaseClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasFirebasePrivateKey: !!privateKey,
        firebasePrivateKeyLooksValid:
            !!privateKey &&
            privateKey.includes("BEGIN PRIVATE KEY") &&
            privateKey.includes("END PRIVATE KEY"),
        firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
    };
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Auth diagnostics failed";
}

export async function GET(request: Request) {
    const env = getEnvStatus();

    try {
        const token = getBearerToken(request);
        if (!token) {
            return NextResponse.json({ env, error: "Missing bearer token" }, { status: 401 });
        }

        const decodedToken = await adminAuth.verifyIdToken(token);
        const supabase = createAdminClient();

        const [{ data: userData, error: userError }, { data: adminData, error: adminError }, { data: employeeData, error: employeeError }] =
            await Promise.all([
                supabase
                    .from("users")
                    .select("firebase_uid, email, role")
                    .eq("firebase_uid", decodedToken.uid)
                    .maybeSingle(),
                supabase
                    .from("admins")
                    .select("firebase_uid, is_super_admin, locked_until")
                    .eq("firebase_uid", decodedToken.uid)
                    .maybeSingle(),
                supabase
                    .from("employees")
                    .select("firebase_uid, status")
                    .eq("firebase_uid", decodedToken.uid)
                    .maybeSingle(),
            ]);

        return NextResponse.json({
            env,
            token: {
                uid: decodedToken.uid,
                email: decodedToken.email ?? null,
                audience: decodedToken.aud,
                issuer: decodedToken.iss,
            },
            supabase: {
                userFound: !!userData,
                userRole: userData?.role ?? null,
                adminFound: !!adminData,
                employeeFound: !!employeeData,
                employeeStatus: employeeData?.status ?? null,
                adminLockedUntil: adminData?.locked_until ?? null,
                errors: {
                    user: userError?.message ?? null,
                    admin: adminError?.message ?? null,
                    employee: employeeError?.message ?? null,
                },
            },
        });
    } catch (error: unknown) {
        return NextResponse.json({ env, error: getErrorMessage(error) }, { status: 500 });
    }
}

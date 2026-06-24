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
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
        const token = getBearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
        }

        const decodedToken = await adminAuth.verifyIdToken(token);
        const supabase = createAdminClient();

        const userPromise = supabase
            .from("users")
            .select("firebase_uid, email, role")
            .eq("firebase_uid", decodedToken.uid)
            .maybeSingle();
        const adminPromise = supabase
            .from("admins")
            .select("firebase_uid, is_super_admin, locked_until")
            .eq("firebase_uid", decodedToken.uid)
            .maybeSingle();
        const employeePromise = supabase
            .from("employees")
            .select("firebase_uid, status")
            .eq("firebase_uid", decodedToken.uid)
            .maybeSingle();

        const [userRes, adminRes, employeeRes] = await Promise.all([
            userPromise,
            adminPromise,
            employeePromise
        ]);

        const userData = userRes.data;
        const userError = userRes.error;
        const adminData = adminRes.data;
        const adminError = adminRes.error;
        const employeeData = employeeRes.data;
        const employeeError = employeeRes.error;

        if (userError || !userData || userData.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const env = getEnvStatus();

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
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

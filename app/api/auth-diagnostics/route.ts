import { NextResponse } from "next/server";
import { createAdminClient } from "../../../utils/supabase/admin";
import {
    getBearerToken,
    jsonError,
    requireAdmin,
} from "../../src/lib/server/apiSecurity";
import { adminAuth } from "../../../utils/firebase/admin";

function diagnosticsAllowed() {
    return process.env.NODE_ENV === "development" && process.env.VERCEL_ENV !== "production";
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (!diagnosticsAllowed()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
        const token = getBearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
        }

        await requireAdmin(request);
        const decodedToken = await adminAuth.verifyIdToken(token);
        const supabase = createAdminClient();

        const [userRes, adminRes, employeeRes] = await Promise.all([
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
            token: {
                uid: decodedToken.uid,
                email: decodedToken.email ?? null,
            },
            supabase: {
                userFound: !!userRes.data,
                userRole: userRes.data?.role ?? null,
                adminFound: !!adminRes.data,
                employeeFound: !!employeeRes.data,
                employeeStatus: employeeRes.data?.status ?? null,
                adminLockedUntil: adminRes.data?.locked_until ?? null,
                errors: {
                    user: userRes.error?.message ?? null,
                    admin: adminRes.error?.message ?? null,
                    employee: employeeRes.error?.message ?? null,
                },
            },
        });
    } catch (error: unknown) {
        return jsonError(error, "Auth diagnostics failed");
    }
}
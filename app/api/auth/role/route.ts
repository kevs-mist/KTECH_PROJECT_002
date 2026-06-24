import { NextResponse } from "next/server";
import { getAdminAuth } from "../../../../utils/firebase/admin";
import { createAdminClient } from "../../../../utils/supabase/admin";

function getBearerToken(request: Request) {
    const authHeader = request.headers.get("authorization");
    return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Unable to verify user role";
}

export async function GET(request: Request) {
    try {
        const token = getBearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "Missing authentication token" }, { status: 401 });
        }

        const adminAuth = getAdminAuth();
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;
        const supabase = createAdminClient();

        const { data: adminData, error: adminError } = await supabase
            .from("admins")
            .select("id")
            .eq("firebase_uid", uid)
            .maybeSingle();

        if (adminError) throw adminError;

        if (adminData) {
            return NextResponse.json({ role: "admin", uid, adminId: adminData.id });
        }

        const { data: employeeData, error: employeeError } = await supabase
            .from("employees")
            .select("id")
            .eq("firebase_uid", uid)
            .maybeSingle();

        if (employeeError) throw employeeError;

        if (employeeData) {
            return NextResponse.json({ role: "employee", uid, employeeId: employeeData.id });
        }

        // Fallback: Check users table role field for employees who may not be in employees table
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("firebase_uid", uid)
            .maybeSingle();

        if (userError) throw userError;

        if (userData && userData.role === "employee") {
            return NextResponse.json({ role: "employee", uid });
        }

        return NextResponse.json({ role: "user", uid });
    } catch (error: unknown) {
        console.error("Role API verification error:", getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

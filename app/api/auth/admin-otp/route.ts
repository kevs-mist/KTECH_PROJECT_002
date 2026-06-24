import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { adminAuth } from "../../../../utils/firebase/admin";
import { createAdminClient } from "../../../../utils/supabase/admin";

function getBearerToken(request: Request) {
    const authHeader = request.headers.get("authorization");
    return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Unable to verify admin security code";
}

export async function POST(request: Request) {
    try {
        const token = getBearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "Missing authentication token" }, { status: 401 });
        }

        const { otp } = await request.json();
        if (!otp || typeof otp !== "string") {
            return NextResponse.json({ error: "Security code is required" }, { status: 400 });
        }

        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;
        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from("admins")
            .select("secret_code, failed_attempts, locked_until")
            .eq("firebase_uid", uid)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: "Admin record not found" }, { status: 403 });
        }

        if (data.locked_until && new Date(data.locked_until) > new Date()) {
            const timeRemaining = Math.ceil((new Date(data.locked_until).getTime() - Date.now()) / 60000);
            return NextResponse.json(
                { error: `Account locked due to multiple failed attempts. Try again in ${timeRemaining} minutes.` },
                { status: 423 }
            );
        }

        let isMatch = false;

        if (data.secret_code && data.secret_code.startsWith("$2")) {
            isMatch = await bcrypt.compare(otp, data.secret_code);
        } else {
            return NextResponse.json(
                { error: "Security code must be reset by an administrator." },
                { status: 400 }
            );
        }

        if (!isMatch) {
            const newAttempts = (data.failed_attempts || 0) + 1;
            const lockedUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null;

            await supabase
                .from("admins")
                .update({
                    failed_attempts: newAttempts,
                    locked_until: lockedUntil,
                })
                .eq("firebase_uid", uid);

            if (newAttempts >= 5) {
                return NextResponse.json(
                    { error: "Too many failed attempts. Account locked for 15 minutes." },
                    { status: 423 }
                );
            }

            return NextResponse.json(
                { error: `Invalid security code. ${5 - newAttempts} attempts remaining.` },
                { status: 401 }
            );
        }

        const updates: Record<string, string | number | null> = {
            failed_attempts: 0,
            locked_until: null,
            last_access: new Date().toISOString(),
        };

        await supabase
            .from("admins")
            .update(updates)
            .eq("firebase_uid", uid);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Admin OTP API error:", getErrorMessage(error));
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

/**
 * Server-Side Registration API Route
 *
 * FIX #1: Replaces the unsafe client-side registration that:
 *   - Detected super-admins by hardcoded email ("admin@company.com")
 *   - Seeded the admins table with a default OTP "123456"
 *   - Wrote directly to Supabase from the browser using the anon key
 *
 * FIX #9: All Supabase writes now happen server-side via the admin client.
 *
 * FIX #16: Basic IP-based rate limiting (5 registrations per IP per hour).
 */

import { NextResponse } from "next/server";
import { adminAuth } from "../../../../utils/firebase/admin";
import { createAdminClient } from "../../../../utils/supabase/admin";

// ── Simple in-memory rate limiter ─────────────────────────────────────────────
// For production with horizontal scaling, replace with Redis / Upstash.
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const WINDOW_MS = 60 * 60 * 1000; // 1 hour
    const MAX_ATTEMPTS = 5;

    const entry = ipAttempts.get(ip);
    if (!entry || entry.resetAt < now) {
        ipAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return true;
    }
    if (entry.count >= MAX_ATTEMPTS) return false;
    entry.count++;
    return true;
}
// ─────────────────────────────────────────────────────────────────────────────

function getBearerToken(request: Request): string | null {
    const authHeader = request.headers.get("authorization");
    return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Registration failed";
}

export async function POST(request: Request) {
    try {
        // ── Rate limiting ────────────────────────────────────────────────────
        const ip =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { error: "Too many registration attempts. Please try again in an hour." },
                { status: 429 }
            );
        }

        // ── Verify Firebase token ────────────────────────────────────────────
        const token = getBearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;
        const email = decodedToken.email;

        if (!email) {
            return NextResponse.json(
                { error: "Email is required for registration" },
                { status: 400 }
            );
        }

        // ── Validate body ────────────────────────────────────────────────────
        const body = await request.json();
        const name: string = (body.name ?? "").trim();
        const isAdminRequested: boolean = !!body.isAdminRequested;

        if (!name || name.length < 2) {
            return NextResponse.json(
                { error: "Full name is required (minimum 2 characters)" },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        // ── Check for duplicate registration ─────────────────────────────────
        const { data: existingUser } = await supabase
            .from("users")
            .select("firebase_uid")
            .eq("firebase_uid", uid)
            .maybeSingle();

        if (existingUser) {
            return NextResponse.json(
                { error: "This account is already registered." },
                { status: 409 }
            );
        }

        // ── Determine role ────────────────────────────────────────────────────
        // Admin role is NEVER granted at registration — it requires admin approval.
        // isAdminRequested → role "user" (pending) until an admin promotes them.
        // Default → role "employee" with immediate access.
        const role: "employee" | "user" = isAdminRequested ? "user" : "employee";

        // ── Insert user record ────────────────────────────────────────────────
        const { error: userError } = await supabase.from("users").insert([
            {
                firebase_uid: uid,
                email,
                full_name: name,
                role,
                created_at: new Date().toISOString(),
            },
        ]);

        if (userError) throw userError;

        // ── If employee: also insert into employees table ─────────────────────
        if (role === "employee") {
            const { error: empError } = await supabase.from("employees").insert([
                {
                    firebase_uid: uid,
                    employee_id: `EMP-${uid.slice(0, 8).toUpperCase()}`,
                    status: "active",
                    joined_at: new Date().toISOString(),
                },
            ]);

            if (empError) {
                // Rollback users insert to maintain consistency
                await supabase.from("users").delete().eq("firebase_uid", uid);
                throw empError;
            }
        }

        // ── If admin requested: create a pending admin_request ────────────────
        if (isAdminRequested) {
            const { error: reqErr } = await supabase
                .from("admin_requests")
                .insert([{ firebase_uid: uid, email, status: "pending" }]);

            if (reqErr) {
                // Rollback users insert
                await supabase.from("users").delete().eq("firebase_uid", uid);
                throw reqErr;
            }
        }

        return NextResponse.json({ success: true, role }, { status: 201 });
    } catch (error: unknown) {
        console.error("Registration API error:", getErrorMessage(error));
        return NextResponse.json(
            { error: getErrorMessage(error) },
            { status: 500 }
        );
    }
}

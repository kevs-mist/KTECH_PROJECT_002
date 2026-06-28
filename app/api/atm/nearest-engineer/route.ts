import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../utils/supabase/admin";
import {
    assertSameOrigin,
    checkRateLimit,
    getClientIp,
    jsonError,
    rateLimitResponse,
    getBearerToken,
    verifyRequestUser,
} from "../../../src/lib/server/apiSecurity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        if (request.method !== "POST") {
            return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
        }

        assertSameOrigin(request);

        const limit = checkRateLimit({
            key: `atm:nearest:${getClientIp(request)}`,
            limit: 60,
            windowMs: 60 * 1000,
        });
        if (!limit.success) return rateLimitResponse(limit.resetAt);

        const token = getBearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify the requesting user is authenticated
        await verifyRequestUser(token);

        // Parse and validate body
        const { atmId } = await request.json();
        if (!atmId || typeof atmId !== "string") {
            return NextResponse.json({ error: "ATM ID is required" }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Step 1: Get the ATM — engineer is already assigned in the DB
        const { data: atm, error: atmError } = await supabase
            .from("atm_locations")
            .select("atm_id, engineer_name, engineer_email, engineer_contact")
            .eq("atm_id", atmId)
            .single();

        if (atmError || !atm) {
            return NextResponse.json({ error: "ATM not found" }, { status: 404 });
        }

        if (!atm.engineer_email) {
            return NextResponse.json(
                { error: "No engineer assigned to this ATM location" },
                { status: 404 }
            );
        }

        // Step 2: Look up engineer's firebase_uid from users table
        const { data: engineerUser } = await supabase
            .from("users")
            .select("firebase_uid")
            .eq("email", atm.engineer_email)
            .eq("role", "employee")
            .single();

        return NextResponse.json({
            success: true,
            data: {
                engineer_name:    atm.engineer_name    ?? null,
                engineer_email:   atm.engineer_email,
                engineer_contact: atm.engineer_contact ?? null,
                engineer_id:      engineerUser?.firebase_uid ?? null,
                method:           "atm_assigned",
            },
        });

    } catch (error: unknown) {
        console.error("[/api/atm/nearest] error:", error);
        return jsonError(error, "Failed to find assigned engineer");
    }
}
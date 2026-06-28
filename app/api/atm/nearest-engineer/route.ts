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

        await verifyRequestUser(token);

        const { atmId } = await request.json();
        if (!atmId || typeof atmId !== "string") {
            return NextResponse.json({ error: "ATM ID is required" }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Fetch ATM row using correct column names from your sheet:
        // bank_name, atm_id, location, address, state, engineer_name, contact_no, email_id
        const { data: atm, error: atmError } = await supabase
            .from("atm_locations")
            .select("atm_id, engineer_name, contact_no, email_id")
            .eq("atm_id", atmId)
            .single();

        if (atmError || !atm) {
            return NextResponse.json({ error: "ATM not found" }, { status: 404 });
        }

        if (!atm.email_id) {
            return NextResponse.json(
                { error: "No engineer assigned to this ATM location" },
                { status: 404 }
            );
        }

        // Look up engineer firebase_uid via email_id
        const { data: engineerUser } = await supabase
            .from("users")
            .select("firebase_uid")
            .eq("email", atm.email_id)
            .eq("role", "employee")
            .single();

        return NextResponse.json({
            success: true,
            data: {
                engineer_name:    atm.engineer_name ?? null,
                engineer_email:   atm.email_id,
                engineer_contact: atm.contact_no    ?? null,
                engineer_id:      engineerUser?.firebase_uid ?? null,
                method:           "atm_assigned",
            },
        });

    } catch (error: unknown) {
        console.error("[/api/atm/nearest] error:", error);
        return jsonError(error, "Failed to find assigned engineer");
    }
}
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
import { resolveEngineerFromAtm } from "../../../src/lib/server/engineerLookup";

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

        // Fetch ATM row. Columns match migration `20260626000001_add_engineer_fields_to_atm_locations.sql`:
        //   engineer_name, engineer_contact, engineer_email
        const { data: atm, error: atmError } = await supabase
            .from("atm_locations")
            .select("atm_id, engineer_name, engineer_contact, engineer_email")
            .eq("atm_id", atmId)
            .maybeSingle();

        if (atmError) {
            console.error("[/api/atm/nearest] atm query error:", atmError);
            return NextResponse.json({ error: "Failed to look up ATM" }, { status: 500 });
        }

        if (!atm) {
            return NextResponse.json({ error: "ATM not found" }, { status: 404 });
        }

        // Resolve engineer by email first, then fall back to name (so an Excel
        // column titled just "engineer" still drives auto-assign).
        const engineer = await resolveEngineerFromAtm(supabase, atm);

        if (!engineer) {
            return NextResponse.json(
                { error: "No engineer assigned to this ATM location" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                engineer_name:    atm.engineer_name ?? null,
                engineer_email:   engineer.email,
                engineer_contact: atm.engineer_contact ?? null,
                engineer_id:      engineer.firebase_uid,
                method:           "atm_assigned",
            },
        });

    } catch (error: unknown) {
        console.error("[/api/atm/nearest] error:", error);
        return jsonError(error, "Failed to find assigned engineer");
    }
}
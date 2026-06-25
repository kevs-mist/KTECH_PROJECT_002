import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../utils/supabase/admin";
import {
    checkRateLimit,
    getClientIp,
    jsonError,
    rateLimitResponse,
    requireVerifiedUser,
} from "../../../src/lib/server/apiSecurity";

export async function GET(request: Request) {
    try {
        const limit = checkRateLimit({
            key: `atm:list:${getClientIp(request)}`,
            limit: 120,
            windowMs: 60 * 1000,
        });
        if (!limit.success) return rateLimitResponse(limit.resetAt);

        await requireVerifiedUser(request);
        const supabase = createAdminClient();

        const { data: atms, error } = await supabase
            .from("atm_locations")
            .select("id, atm_id, bank_name, location, address, engineer_name, engineer_contact, engineer_email")
            .order("atm_id", { ascending: true });

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data: atms || []
        });
    } catch (error: unknown) {
        return jsonError(error, "Failed to fetch ATM list");
    }
}
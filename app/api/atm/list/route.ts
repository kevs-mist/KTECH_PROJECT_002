import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../utils/supabase/admin";
import {
    checkRateLimit,
    getClientIp,
    jsonError,
    rateLimitResponse,
    requireVerifiedUser,
} from "../../../src/lib/server/apiSecurity";

// 1. Force Next.js to skip pre-rendering this file at build time
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // 2. Safely capture the IP, falling back to a dummy string if empty during build
        const ip = getClientIp(request) || "127.0.0.1";

        // 3. Make sure to await checkRateLimit if it contacts an external store (like Redis)
        const limit = await checkRateLimit({
            key: `atm:list:${ip}`,
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

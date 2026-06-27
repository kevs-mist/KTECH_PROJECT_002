import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../utils/supabase/admin";
import {
    checkRateLimit,
    getClientIp,
    jsonError,
    rateLimitResponse,
    requireVerifiedUser,
} from "../../../src/lib/server/apiSecurity";

 export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ atmId: string }> }) {
  try {
    const limit = checkRateLimit({
      key: `atm:detail:${getClientIp(request)}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    await requireVerifiedUser(request);
    const { atmId } = await context.params;
    const supabase = createAdminClient();

    const { data: atm, error } = await supabase
      .from("atm_locations")
      .select("*")
      .eq("atm_id", atmId)
      .single();

    if (error || !atm) {
      return NextResponse.json({ error: "ATM not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: atm
    });
  } catch (error: unknown) {
    return jsonError(error, "Failed to fetch ATM details");
  }
}
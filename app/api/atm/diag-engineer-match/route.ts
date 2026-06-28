import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../utils/supabase/admin";
import {
  assertSameOrigin,
  checkRateLimit,
  getClientIp,
  jsonError,
  rateLimitResponse,
  requireAdmin,
} from "../../../src/lib/server/apiSecurity";

export const dynamic = "force-dynamic";

/**
 * DEBUG ONLY — diagnose why engineer auto-assign fails.
 *
 * Compares atm_locations.engineer_name against users.full_name (role=employee)
 * to surface whitespace/case differences that cause silent mismatches.
 *
 * Restricted to admins. Safe to delete once data is fixed.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const limit = checkRateLimit({
      key: `atm:diag:${getClientIp(request)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    await requireAdmin(request);
    const supabase = createAdminClient();

    const { data: atms } = await supabase
      .from("atm_locations")
      .select("atm_id, engineer_name, engineer_email")
      .not("engineer_name", "is", null);

    const { data: users } = await supabase
      .from("users")
      .select("firebase_uid, full_name, email, role")
      .eq("role", "employee");

    const norm = (s: string | null | undefined) =>
      (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

    const employees = (users ?? []).map((u) => ({
      ...u,
      _norm_name: norm(u.full_name),
      _norm_email: norm(u.email),
    }));

    const report = (atms ?? []).map((a) => {
      const targetName = norm(a.engineer_name);
      const targetEmail = norm(a.engineer_email);

      const byEmail = targetEmail
        ? employees.find((e) => e._norm_email === targetEmail)
        : null;
      const byName = targetName
        ? employees.find((e) => e._norm_name === targetName)
        : null;

      // Show close matches when no exact hit (helps spot typos / extra spaces).
      const closeNameMatches = !byName && targetName
        ? employees
            .filter((e) => e._norm_name.includes(targetName) || targetName.includes(e._norm_name))
            .slice(0, 3)
            .map((e) => e.full_name)
        : [];

      return {
        atm_id: a.atm_id,
        engineer_name_raw: a.engineer_name,
        engineer_email_raw: a.engineer_email,
        engineer_name_norm: targetName || null,
        engineer_email_norm: targetEmail || null,
        matched_by_email: byEmail ? { email: byEmail.email, full_name: byEmail.full_name } : null,
        matched_by_name: byName ? { email: byName.email, full_name: byName.full_name } : null,
        close_name_matches: closeNameMatches,
        status: byEmail ? "ok_email" : byName ? "ok_name" : "unmatched",
      };
    });

    const totals = {
      atms_with_engineer_name: (atms ?? []).length,
      employees: employees.length,
      ok_email: report.filter((r) => r.status === "ok_email").length,
      ok_name: report.filter((r) => r.status === "ok_name").length,
      unmatched: report.filter((r) => r.status === "unmatched").length,
    };

    return NextResponse.json({ success: true, totals, rows: report });
  } catch (error: unknown) {
    return jsonError(error, "Diagnostics failed");
  }
}
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "../../../../utils/supabase/admin";
import {
  assertSameOrigin,
  checkRateLimit,
  getClientIp,
  jsonError,
  logAuditEvent,
  rateLimitResponse,
  requireAdmin,
} from "../../../src/lib/server/apiSecurity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const limit = checkRateLimit({
      key: `admin-requests:approve:${getClientIp(request)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    const admin = await requireAdmin(request);
    const { requestId, action, secretCode } = await request.json();

    if (!requestId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = createAdminClient();

    if (action === "approve") {
      if (!secretCode || String(secretCode).length < 8) {
        return NextResponse.json({ error: "Secret code must be at least 8 characters" }, { status: 400 });
      }

      const { data: requestData, error: fetchError } = await supabase
        .from("admin_requests")
        .select("firebase_uid")
        .eq("id", requestId)
        .eq("status", "pending")
        .single();

      if (fetchError) throw fetchError;

      const hashedSecretCode = await bcrypt.hash(String(secretCode), 12);

      const { error: insertError } = await supabase
        .from("admins")
        .insert([
          {
            firebase_uid: requestData.firebase_uid,
            secret_code: hashedSecretCode,
            is_super_admin: false,
            last_access: new Date().toISOString()
          }
        ]);

      if (insertError) throw insertError;

      const { error: userUpdateError } = await supabase
        .from("users")
        .update({ role: "admin" })
        .eq("firebase_uid", requestData.firebase_uid);

      if (userUpdateError) throw userUpdateError;

      const { error: updateError } = await supabase
        .from("admin_requests")
        .update({ status: "approved", reviewed_by: admin.uid, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);

      if (updateError) throw updateError;

      await logAuditEvent({
        actorUid: admin.uid,
        action: "admin_request.approve",
        resourceType: "admin_request",
        resourceId: requestId,
        metadata: { promotedUid: requestData.firebase_uid },
        request,
      });
    } else {
      const { error } = await supabase
        .from("admin_requests")
        .update({ status: "rejected", reviewed_by: admin.uid, reviewed_at: new Date().toISOString() })
        .eq("id", requestId)
        .eq("status", "pending");

      if (error) throw error;

      await logAuditEvent({
        actorUid: admin.uid,
        action: "admin_request.reject",
        resourceType: "admin_request",
        resourceId: requestId,
        request,
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    return jsonError(error, "Admin request approval failed");
  }
}
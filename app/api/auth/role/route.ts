import { NextResponse } from "next/server";
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
      key: `auth:role:${getClientIp(request)}`,
      limit: 120,
      windowMs: 60 * 1000,
    });

    if (!limit.success) return rateLimitResponse(limit.resetAt);

    const user = await requireVerifiedUser(request);
    return NextResponse.json({
      role: user.role,
      uid: user.uid,
      adminId: user.adminId,
      employeeId: user.employeeId,
    });
  } catch (error: unknown) {
    return jsonError(error, "Unable to verify user role");
  }
}
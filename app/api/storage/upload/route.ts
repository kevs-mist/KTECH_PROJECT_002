import { NextResponse } from "next/server";
import { uploadMediaAction } from "../../../src/lib/actions/storageActions";
import {
  assertSameOrigin,
  checkRateLimit,
  getBearerToken,
  getClientIp,
  jsonError,
  rateLimitResponse,
  verifyRequestUser,
} from "../../../src/lib/server/apiSecurity";

export async function POST(request: Request) {
  try {
    if (request.method !== "POST") {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    assertSameOrigin(request);

    const limit = checkRateLimit({
      key: `upload:${getClientIp(request)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized to upload media." }, { status: 401 });
    }
    const user = await verifyRequestUser(token);
    // The uploadMediaAction will check that the user is employee or admin via verifyUserRoleAction

    const formData = await request.formData();
    const publicUrl = await uploadMediaAction(token, formData);
    return NextResponse.json({ publicUrl });
  } catch (error: unknown) {
    return jsonError(error, "Upload failed");
  }
}
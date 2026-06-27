import { NextResponse } from "next/server";
import { 
  getNotificationsAction, 
  markNotificationReadAction, 
  markAllNotificationsReadAction 
} from "../../src/lib/actions/notificationActions";
import {
  assertSameOrigin,
  checkRateLimit,
  getBearerToken,
  getClientIp,
  jsonError,
  rateLimitResponse,
} from "../../src/lib/server/apiSecurity";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Notification request failed";
}

function requireToken(request: Request) {
  const token = getBearerToken(request);
  if (!token) throw new Error("Unauthorized: Please log in again.");
  return token;
}

export async function GET(request: Request) {
  try {
    const limit = checkRateLimit({
      key: `notifications:get:${getClientIp(request)}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    const token = requireToken(request);
    return NextResponse.json(await getNotificationsAction(token));
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);

    const limit = checkRateLimit({
      key: `notifications:patch:${getClientIp(request)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    const token = requireToken(request);
    const body = await request.json();

    if (body.action === "mark_read" && body.notificationId) {
      await markNotificationReadAction(token, body.notificationId);
      return NextResponse.json({ success: true });
    } else if (body.action === "mark_all_read") {
      await markAllNotificationsReadAction(token);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  checkRateLimit,
  getBearerToken,
  getClientIp,
  jsonError,
  rateLimitResponse,
  verifyRequestUser,
} from "../../src/lib/server/apiSecurity";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "../../src/lib/actions/notificationActions";

export async function GET(request: Request) {
  try {
    if (request.method !== "GET") {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    const limit = checkRateLimit({
      key: `notifications:get:${getClientIp(request)}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await verifyRequestUser(token);

    return NextResponse.json(await getNotificationsAction(token));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Notification request failed";
    const status = message.toLowerCase().includes("unauthorized")
      ? 401
      : message.toLowerCase().includes("forbidden")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    if (request.method !== "PATCH") {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    assertSameOrigin(request);

    const limit = checkRateLimit({
      key: `notifications:patch:${getClientIp(request)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await verifyRequestUser(token);

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
    const message = error instanceof Error ? error.message : "Notification request failed";
    const status = message.toLowerCase().includes("unauthorized")
      ? 401
      : message.toLowerCase().includes("forbidden")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
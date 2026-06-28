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
import { MailingService } from "../../src/lib/services/mailingservice";
import { sendTicketVerification } from "@/utils/email";
import { employeeService } from "../../src/lib/services/employeeService";

export async function GET(request: Request) {
  try {
    if (request.method !== "GET") {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    const limit = checkRateLimit({
      key: `tickets:get:${getClientIp(request)}`,
      limit: 180,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await verifyRequestUser(token);

    const url = new URL(request.url);
    const resource = url.searchParams.get("resource");

    if (resource === "admin-stats") {
      if (user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
      }
      const { getAdminStatsAction } = await import("../../src/lib/actions/ticketActions");
      return NextResponse.json(await getAdminStatsAction(token));
    }

    const { getTicketsAction } = await import("../../src/lib/actions/ticketActions");
    return NextResponse.json(await getTicketsAction(token));
  } catch (error: unknown) {
    return jsonError(error, "Ticket request failed");
  }
}

export async function POST(request: Request) {
  try {
    if (request.method !== "POST") {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    assertSameOrigin(request);

    const limit = checkRateLimit({
      key: `tickets:post:${getClientIp(request)}`,
      limit: 90,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await verifyRequestUser(token);

    const body = await request.json();
    const {
      acceptTicketAction,
      adminCloseTicketAction,
      adminReleaseTicketAction,
      assignTicketToEmployeeAction,
      createTicketAction,
      escalateTicketAction,
      markInProgressAction,
      resolveTicketAction,
      checkInAction,
    } = await import("../../src/lib/actions/ticketActions");

    switch (body.operation) {
      case "create":
        if (user.role !== "admin") {
          return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        return NextResponse.json(await createTicketAction(token, body.ticket));
      case "accept":
        if (user.role !== "employee") {
          return NextResponse.json({ error: "Forbidden: Employee access required" }, { status: 403 });
        }
        return NextResponse.json(await acceptTicketAction(token, body.ticketId, body.currentVersion));
      case "resolve":
        if (user.role !== "employee") {
          return NextResponse.json({ error: "Forbidden: Employee access required" }, { status: 403 });
        }
        return NextResponse.json(
          await resolveTicketAction(
            token,
            body.ticketId,
            body.currentVersion,
            body.proofMediaUrl,
            body.resolutionNotes
          )
        );
      case "escalate":
        if (user.role !== "employee") {
          return NextResponse.json({ error: "Forbidden: Employee access required" }, { status: 403 });
        }
        return NextResponse.json(
          await escalateTicketAction(
            token,
            body.ticketId,
            body.currentVersion,
            body.proofMediaUrl,
            body.escalationNotes
          )
        );
      case "mark-in-progress":
        if (user.role !== "employee") {
          return NextResponse.json({ error: "Forbidden: Employee access required" }, { status: 403 });
        }
        return NextResponse.json(await markInProgressAction(token, body.ticketId, body.currentVersion));
      case "check-in":
        if (user.role !== "employee") {
          return NextResponse.json({ error: "Forbidden: Employee access required" }, { status: 403 });
        }
        return NextResponse.json(
          await checkInAction(
            token,
            body.ticketId,
            body.currentVersion,
            body.latitude,
            body.longitude
          )
        );
      case "admin-close":
        if (user.role !== "admin") {
          return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        return NextResponse.json(
          await adminCloseTicketAction(token, body.ticketId, body.currentVersion, body.adminNotes)
        );
      case "assign":
        if (user.role !== "admin") {
          return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        return NextResponse.json(
          await assignTicketToEmployeeAction(token, body.ticketId, body.employeeUid, body.currentVersion)
        );
      case "admin-release":
        if (user.role !== "admin") {
          return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        return NextResponse.json(
          await adminReleaseTicketAction(token, body.ticketId, body.currentVersion)
        );
      default:
        return NextResponse.json({ error: "Unknown ticket operation" }, { status: 400 });
    }
  } catch (error: unknown) {
    return jsonError(error, "Ticket request failed");
  }
}
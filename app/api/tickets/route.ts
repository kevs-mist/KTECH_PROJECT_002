import { NextResponse } from "next/server";
import {
    assertSameOrigin,
    checkRateLimit,
    getBearerToken,
    getClientIp,
    jsonError,
    rateLimitResponse,
} from "../../src/lib/server/apiSecurity";

function requireToken(request: Request) {
    const token = getBearerToken(request);
    if (!token) throw new Error("Unauthorized: Please log in again.");
    return token;
}

export async function GET(request: Request) {
    try {
        const limit = checkRateLimit({
            key: `tickets:get:${getClientIp(request)}`,
            limit: 180,
            windowMs: 60 * 1000,
        });
        if (!limit.success) return rateLimitResponse(limit.resetAt);

        const token = requireToken(request);
        const url = new URL(request.url);
        const resource = url.searchParams.get("resource");

        if (resource === "admin-stats") {
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
        assertSameOrigin(request);

        const limit = checkRateLimit({
            key: `tickets:post:${getClientIp(request)}`,
            limit: 90,
            windowMs: 60 * 1000,
        });
        if (!limit.success) return rateLimitResponse(limit.resetAt);

        const token = requireToken(request);
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
                return NextResponse.json(await createTicketAction(token, body.ticket));
            case "accept":
                return NextResponse.json(await acceptTicketAction(token, body.ticketId, body.currentVersion));
            case "resolve":
                return NextResponse.json(await resolveTicketAction(token, body.ticketId, body.currentVersion, body.proofMediaUrl, body.resolutionNotes));
            case "escalate":
                return NextResponse.json(await escalateTicketAction(token, body.ticketId, body.currentVersion, body.proofMediaUrl, body.escalationNotes));
            case "mark-in-progress":
                return NextResponse.json(await markInProgressAction(token, body.ticketId, body.currentVersion));
            case "check-in":
                return NextResponse.json(await checkInAction(token, body.ticketId, body.currentVersion, body.latitude, body.longitude));
            case "admin-close":
                return NextResponse.json(await adminCloseTicketAction(token, body.ticketId, body.currentVersion, body.adminNotes));
            case "assign":
                return NextResponse.json(await assignTicketToEmployeeAction(token, body.ticketId, body.employeeUid, body.currentVersion));
            case "admin-release":
                return NextResponse.json(await adminReleaseTicketAction(token, body.ticketId, body.currentVersion));
            default:
                return NextResponse.json({ error: "Unknown ticket operation" }, { status: 400 });
        }
    } catch (error: unknown) {
        return jsonError(error, "Ticket request failed");
    }
}
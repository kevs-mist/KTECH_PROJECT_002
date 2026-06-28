import "server-only";
import { NextResponse } from "next/server";
import {
    assertSameOrigin,
    checkRateLimit,
    getBearerToken,
    getClientIp,
    jsonError,
    rateLimitResponse,
} from "../../src/lib/server/apiSecurity";

export const dynamic = "force-dynamic";

function requireToken(request: Request): string {
    const token = getBearerToken(request);
    if (!token) throw new Error("Unauthorized: Please log in again.");
    return token;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

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
        console.error("[/api/tickets GET] error:", error);
        return jsonError(error, "Ticket request failed");
    }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

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

        // Validate operation exists
        if (!body.operation || typeof body.operation !== "string") {
            return NextResponse.json({ error: "Operation is required" }, { status: 400 });
        }

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

            case "create": {
                if (!body.ticket) {
                    return NextResponse.json({ error: "ticket data is required" }, { status: 400 });
                }
                const ticket = await createTicketAction(token, body.ticket);
                return NextResponse.json(ticket);
            }

            case "accept": {
                if (!body.ticketId || body.currentVersion === undefined) {
                    return NextResponse.json({ error: "ticketId and currentVersion are required" }, { status: 400 });
                }
                return NextResponse.json(
                    await acceptTicketAction(token, body.ticketId, body.currentVersion)
                );
            }

            case "resolve": {
                if (!body.ticketId || body.currentVersion === undefined || !body.proofMediaUrl) {
                    return NextResponse.json(
                        { error: "ticketId, currentVersion and proofMediaUrl are required" },
                        { status: 400 }
                    );
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
            }

            case "escalate": {
                if (!body.ticketId || body.currentVersion === undefined) {
                    return NextResponse.json({ error: "ticketId and currentVersion are required" }, { status: 400 });
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
            }

            case "mark-in-progress": {
                if (!body.ticketId || body.currentVersion === undefined) {
                    return NextResponse.json({ error: "ticketId and currentVersion are required" }, { status: 400 });
                }
                return NextResponse.json(
                    await markInProgressAction(token, body.ticketId, body.currentVersion)
                );
            }

            case "check-in": {
                if (!body.ticketId || body.currentVersion === undefined) {
                    return NextResponse.json({ error: "ticketId and currentVersion are required" }, { status: 400 });
                }
                const lat = Number(body.latitude);
                const lon = Number(body.longitude);
                if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    return NextResponse.json({ error: "Valid latitude and longitude are required" }, { status: 400 });
                }
                return NextResponse.json(
                    await checkInAction(token, body.ticketId, body.currentVersion, lat, lon)
                );
            }

            case "admin-close": {
                if (!body.ticketId || body.currentVersion === undefined) {
                    return NextResponse.json({ error: "ticketId and currentVersion are required" }, { status: 400 });
                }
                return NextResponse.json(
                    await adminCloseTicketAction(token, body.ticketId, body.currentVersion, body.adminNotes)
                );
            }

            case "assign": {
                if (!body.ticketId || !body.employeeUid || body.currentVersion === undefined) {
                    return NextResponse.json(
                        { error: "ticketId, employeeUid and currentVersion are required" },
                        { status: 400 }
                    );
                }
                return NextResponse.json(
                    await assignTicketToEmployeeAction(
                        token,
                        body.ticketId,
                        body.employeeUid,
                        body.currentVersion
                    )
                );
            }

            case "admin-release": {
                if (!body.ticketId || body.currentVersion === undefined) {
                    return NextResponse.json({ error: "ticketId and currentVersion are required" }, { status: 400 });
                }
                return NextResponse.json(
                    await adminReleaseTicketAction(token, body.ticketId, body.currentVersion)
                );
            }

            default:
                return NextResponse.json({ error: "Unknown ticket operation" }, { status: 400 });
        }

    } catch (error: unknown) {
        console.error("[/api/tickets POST] error:", error);
        return jsonError(error, "Ticket request failed");
    }
}
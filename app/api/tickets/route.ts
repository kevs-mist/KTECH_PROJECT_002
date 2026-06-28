import "server-only";
import { NextResponse } from "next/server";
// Most common in Next.js + Supabase projects
import { createAdminClient } from "@/utils/supabase/admin";
import {
    assertSameOrigin,
    checkRateLimit,
    getBearerToken,
    getClientIp,
    jsonError,
    rateLimitResponse,
    verifyRequestUser,
} from "../../src/lib/server/apiSecurity";
import { mailingService } from "../../../app/src/lib/services/mailingservice";

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
        const user = await verifyRequestUser(token);

        const body = await request.json();

        if (!body.operation || typeof body.operation !== "string") {
            return NextResponse.json({ error: "Operation is required" }, { status: 400 });
        }

        const supabase = createAdminClient();

        // ── CREATE — auto-assigns engineer from atm_locations ───────────────
        if (body.operation === "create") {
            if (!body.ticket) {
                return NextResponse.json({ error: "ticket data is required" }, { status: 400 });
            }

            const ticket = body.ticket;

            // Validate required ticket fields
            if (!ticket.title || ticket.title.length < 5) {
                return NextResponse.json({ error: "title must be at least 5 characters" }, { status: 400 });
            }
            if (!ticket.description || ticket.description.length < 10) {
                return NextResponse.json({ error: "description must be at least 10 characters" }, { status: 400 });
            }
            if (!ticket.atm_id) {
                return NextResponse.json({ error: "atm_id is required" }, { status: 400 });
            }

            let assignedTo: string | null = null;
            let assignedEmail: string | null = null;
            let assignedName: string | null = null;
            let initialStatus = "open";

            // Look up engineer from atm_locations using correct column names
            const { data: atm } = await supabase
                .from("atm_locations")
                .select("engineer_name, email_id, contact_no")
                .eq("atm_id", ticket.atm_id)
                .single();

            if (atm?.email_id) {
                // Get engineer's firebase_uid from users table
                const { data: engineer } = await supabase
                    .from("users")
                    .select("firebase_uid, full_name, email, employee_id, department, status, joined_at, is_online, last_seen, active_tickets, closed_tickets")
                    .eq("email", atm.email_id)
                    .eq("role", "employee")
                    .single();

                if (engineer?.firebase_uid) {
                    assignedTo    = engineer.firebase_uid;
                    assignedEmail = engineer.email;
                    assignedName  = engineer.full_name;
                    initialStatus = "assigned";
                }
            }

            // Insert ticket with auto-assigned engineer
            const { data: newTicket, error: insertError } = await supabase
                .from("tickets")
                .insert({
                    ...ticket,
                    assigned_to:  assignedTo,
                    status:       initialStatus,
                    created_by:   user.uid,
                    created_at:   new Date().toISOString(),
                    updated_at:   new Date().toISOString(),
                    version:      1,
                })
                .select()
                .single();

            if (insertError || !newTicket) {
                console.error("[/api/tickets create] insert error:", insertError);
                return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
            }

            // Fire assignment email — never let this break ticket creation
            if (assignedTo && assignedEmail) {
                try {
                    await mailingService.notify("ticket_assigned", newTicket, {
                        firebase_uid:   assignedTo,
                        email:          assignedEmail,
                        full_name:      assignedName,
                        employee_id:    "",
                        department:     null,
                        status:         "active",
                        joined_at:      "",
                        is_online:      false,
                        last_seen:      "",
                        active_tickets: 0,
                        closed_tickets: 0,
                    });
                } catch (emailErr) {
                    console.error("[/api/tickets create] email failed:", emailErr);
                }
            }

            return NextResponse.json(newTicket);
        }

        // ── ALL OTHER OPERATIONS ────────────────────────────────────────────
        const {
            acceptTicketAction,
            adminCloseTicketAction,
            adminReleaseTicketAction,
            assignTicketToEmployeeAction,
            escalateTicketAction,
            markInProgressAction,
            resolveTicketAction,
            checkInAction,
        } = await import("../../src/lib/actions/ticketActions");

        switch (body.operation) {

            case "accept": {
                if (!body.ticketId || body.currentVersion === undefined) {
                    return NextResponse.json(
                        { error: "ticketId and currentVersion are required" },
                        { status: 400 }
                    );
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
                    return NextResponse.json(
                        { error: "ticketId and currentVersion are required" },
                        { status: 400 }
                    );
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
                    return NextResponse.json(
                        { error: "ticketId and currentVersion are required" },
                        { status: 400 }
                    );
                }
                return NextResponse.json(
                    await markInProgressAction(token, body.ticketId, body.currentVersion)
                );
            }

            case "check-in": {
                if (!body.ticketId || body.currentVersion === undefined) {
                    return NextResponse.json(
                        { error: "ticketId and currentVersion are required" },
                        { status: 400 }
                    );
                }
                const lat = Number(body.latitude);
                const lon = Number(body.longitude);
                if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    return NextResponse.json(
                        { error: "Valid latitude and longitude are required" },
                        { status: 400 }
                    );
                }
                return NextResponse.json(
                    await checkInAction(token, body.ticketId, body.currentVersion, lat, lon)
                );
            }

            case "admin-close": {
                if (!body.ticketId || body.currentVersion === undefined) {
                    return NextResponse.json(
                        { error: "ticketId and currentVersion are required" },
                        { status: 400 }
                    );
                }
                return NextResponse.json(
                    await adminCloseTicketAction(
                        token,
                        body.ticketId,
                        body.currentVersion,
                        body.adminNotes
                    )
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
                    return NextResponse.json(
                        { error: "ticketId and currentVersion are required" },
                        { status: 400 }
                    );
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
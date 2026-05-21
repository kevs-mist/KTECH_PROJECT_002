import { NextResponse } from "next/server";
import {
    acceptTicketAction,
    adminCloseTicketAction,
    adminReleaseTicketAction,
    assignTicketToEmployeeAction,
    createTicketAction,
    escalateTicketAction,
    getAdminStatsAction,
    getTicketsAction,
    markInProgressAction,
    resolveTicketAction,
} from "../../src/lib/actions/ticketActions";

function getBearerToken(request: Request) {
    const authHeader = request.headers.get("authorization");
    return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Ticket request failed";
}

function requireToken(request: Request) {
    const token = getBearerToken(request);
    if (!token) throw new Error("Unauthorized: Please log in again.");
    return token;
}

export async function GET(request: Request) {
    try {
        const token = requireToken(request);
        const url = new URL(request.url);
        const resource = url.searchParams.get("resource");

        if (resource === "admin-stats") {
            return NextResponse.json(await getAdminStatsAction(token));
        }

        return NextResponse.json(await getTicketsAction(token));
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const token = requireToken(request);
        const body = await request.json();

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
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

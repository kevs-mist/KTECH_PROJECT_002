import { NextResponse } from "next/server";
import { getAdminAuth } from "../../../utils/firebase/admin";
import { createAdminClient } from "../../../utils/supabase/admin";

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

async function getAdminStats(token: string) {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const supabase = createAdminClient();

    const { data: adminData, error: adminError } = await supabase
        .from("admins")
        .select("id")
        .eq("firebase_uid", decodedToken.uid)
        .maybeSingle();

    if (adminError) throw adminError;
    if (!adminData) throw new Error("Unauthorized: Admin access required.");

    const [totalResult, openResult, closedResult, escalatedResult] = await Promise.all([
        supabase.from("tickets").select("*", { count: "exact", head: true }),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "closed"),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "re_raised"),
    ]);

    const firstError = totalResult.error || openResult.error || closedResult.error || escalatedResult.error;
    if (firstError) throw firstError;

    return {
        total: totalResult.count || 0,
        open: openResult.count || 0,
        closed: closedResult.count || 0,
        escalated: escalatedResult.count || 0,
    };
}

export async function GET(request: Request) {
    try {
        const token = requireToken(request);
        const url = new URL(request.url);
        const resource = url.searchParams.get("resource");

        if (resource === "admin-stats") {
            return NextResponse.json(await getAdminStats(token));
        }

        const { getTicketsAction } = await import("../../src/lib/actions/ticketActions");
        return NextResponse.json(await getTicketsAction(token));
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(request: Request) {
    try {
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
        const message = getErrorMessage(error);
        const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

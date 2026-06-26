import { verifyUserRoleAction } from "./authActions";
import { createAdminClient } from "../../../../utils/supabase/admin";
import { Ticket } from "../services/ticketService";
import { z } from "zod";
import { sanitizeText } from "../security/sanitizer";
import { revalidatePath } from "next/cache";

import { logAuditEvent } from "../server/apiSecurity";

// Whitelist and Validation Schemas
const ticketCreateSchema = z.object({
    title: z.string().trim().min(5, "Title too short").max(200),
    description: z.string().min(10, "Description must be at least 10 characters"),
    issue_type: z.string().min(2, "Issue type is required"),
    atm_id: z.string().min(3, "ATM ID is required"),
    atm_location_id: z.string().uuid().optional(),
    bank_id: z.string().min(2, "Bank ID is required"),
    atm_location: z.string().trim().min(5),
    bank_location: z.string().trim().optional(),
    // Optional pre-assignment when admin creates ticket
    assigned_to: z.string().trim().optional(),
});

import { unstable_noStore as noStore } from "next/cache";

/**
 * Securely fetch tickets based on user role.
 */
export async function getTicketsAction(idToken: string) {
    noStore();
    const { role, uid } = await verifyUserRoleAction(idToken);
    const supabase = createAdminClient();

    if (role === "admin") {
        const { data, error } = await supabase
            .from("tickets")
            .select("*, check_ins(*)")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    } else if (role === "employee") {
        // Fetch tickets assigned to this employee OR open/unassigned tickets
        // We need to do two separate queries and merge because Supabase .or() 
        // doesn't support complex filters with and() properly
        const [assignedResult, unassignedResult] = await Promise.all([
            // Tickets assigned to this employee
            supabase
                .from("tickets")
                .select("*, check_ins(*)")
                .eq("assigned_to", uid)
                .order("created_at", { ascending: false }),
            // Open unassigned tickets available for this employee
            supabase
                .from("tickets")
                .select("*, check_ins(*)")
                .eq("status", "open")
                .is("assigned_to", null)
                .order("created_at", { ascending: false })
        ]);

        if (assignedResult.error) throw assignedResult.error;
        if (unassignedResult.error) throw unassignedResult.error;

        // Merge results and remove duplicates
        const ticketMap = new Map();
        [...(assignedResult.data || []), ...(unassignedResult.data || [])].forEach(ticket => {
            if (ticket.id && !ticketMap.has(ticket.id)) {
                ticketMap.set(ticket.id, ticket);
            }
        });

        return Array.from(ticketMap.values()).sort((a, b) => 
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
    } else {
        const { data, error } = await supabase
            .from("tickets")
            .select("*, check_ins(*)")
            .eq("created_by", uid)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }
}

/**
 * Securely create a ticket (Admin only)
 */
export async function createTicketAction(idToken: string, ticket: Ticket) {
    const { role, uid } = await verifyUserRoleAction(idToken);
    if (role !== "admin") throw new Error("Unauthorized: Admin access required.");

    // Validate and Whitelist fields
    const parseResult = ticketCreateSchema.safeParse(ticket);
    if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        throw new Error(`${firstError.message}`);
    }
    const validatedData = parseResult.data;

    const supabase = createAdminClient();

    // Verify pre-assigned employee exists in the employees table
    if (validatedData.assigned_to) {
        const { data: employeeExists } = await supabase
            .from("employees")
            .select("firebase_uid")
            .eq("firebase_uid", validatedData.assigned_to)
            .maybeSingle();

        if (!employeeExists) {
            throw new Error("Cannot pre-assign: the selected engineer does not exist in the system.");
        }
    }

    // If admin pre-assigns, start in 'assigned' status
    // Sanitize user inputs to prevent XSS
    const sanitizedData = {
        ...validatedData,
        atm_id: sanitizeText(ticket.atm_id),
        atm_location_id: ticket.atm_location_id,
        bank_id: sanitizeText(ticket.bank_id),
        title: sanitizeText(validatedData.title),
        description: sanitizeText(validatedData.description),
        atm_location: sanitizeText(validatedData.atm_location),
        bank_location: sanitizeText(validatedData.bank_location),
    };

    const initialStatus = sanitizedData.assigned_to ? "assigned" : "open";
    const { data, error } = await supabase
        .from("tickets")
        .insert([{ 
            ...sanitizedData, 
            created_by: uid,
            status: initialStatus,
            updated_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) throw error;

    await logAuditEvent({
        actorUid: uid,
        action: "ticket.create",
        resourceType: "ticket",
        resourceId: data.id,
        metadata: { status: initialStatus, assignedTo: sanitizedData.assigned_to ?? null },
    });

   
    return data;
}

/**
 * Securely accept a ticket (Employee only)
 */
export async function acceptTicketAction(idToken: string, ticketId: string, currentVersion: number) {
    const { role, uid } = await verifyUserRoleAction(idToken);
    if (role !== "employee") throw new Error("Unauthorized: Employee access required.");

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("tickets")
        .update({ 
            assigned_to: uid,
            status: "in_progress",
            updated_at: new Date().toISOString()
        })
        .eq("id", ticketId)
        .eq("status", "open") // CRITICAL: Race condition protection
        .eq("version", currentVersion)
        .select()
        .single();

    if (error || !data) {
        if (error?.code === 'PGRST116' || !data) {
            throw new Error("This ticket has already been accepted or modified by another engineer.");
        }
        throw error;
    }
    await logAuditEvent({
        actorUid: uid,
        action: "ticket.accept",
        resourceType: "ticket",
        resourceId: ticketId,
    });
    revalidatePath("/", "layout");
    return data;
}

/**
 * Securely get stats (Admin only)
 */
export async function getAdminStatsAction(idToken: string) {
    const { role } = await verifyUserRoleAction(idToken);
    if (role !== "admin") throw new Error("Unauthorized.");

    const supabase = createAdminClient();
    const { count: total } = await supabase.from("tickets").select("*", { count: "exact", head: true });
    const { count: open } = await supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "open");
    const { count: closed } = await supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "closed");
    const { count: escalated } = await supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "re_raised");
    
    return { 
        total: total || 0, 
        open: open || 0, 
        closed: closed || 0,
        escalated: escalated || 0 
    };
}

/**
 * Securely mark a ticket as resolved (Employee only)
 */
export async function resolveTicketAction(idToken: string, ticketId: string, currentVersion: number, proofMediaUrl: string, resolutionNotes?: string) {
    const { role, uid } = await verifyUserRoleAction(idToken);
    if (role !== "employee") throw new Error("Unauthorized: Employee access required.");

    // Validate and sanitize inputs
    if (!proofMediaUrl) throw new Error("Proof of work is required.");
    const sanitizedNotes = sanitizeText(resolutionNotes).slice(0, 2000);

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("tickets")
        .update({ 
            status: "closed",
            proof_media_url: proofMediaUrl,
            resolution_notes: sanitizedNotes,
            updated_at: new Date().toISOString()
        })
        .eq("id", ticketId)
        .eq("assigned_to", uid) // Ensure the employee owns the ticket
        .eq("status", "in_progress") // ENFORCE: must be in progress first
        .eq("version", currentVersion)
        .select()
        .single();

    if (error || !data) {
        throw new Error("Failed to resolve. The ticket must be 'In Progress' first, or it has been updated elsewhere.");
    }
    await logAuditEvent({
        actorUid: uid,
        action: "ticket.resolve",
        resourceType: "ticket",
        resourceId: ticketId,
    });
    revalidatePath("/", "layout");
    return data;
}

/**
 * Securely escalate a ticket (Employee only)
 */
export async function escalateTicketAction(idToken: string, ticketId: string, currentVersion: number, proofMediaUrl?: string, escalationNotes?: string) {
    const { role, uid } = await verifyUserRoleAction(idToken);
    if (role !== "employee") throw new Error("Unauthorized: Employee access required.");

    // Validate and sanitize inputs
    if (!escalationNotes?.trim()) throw new Error("Reason for escalation is required.");
    const sanitizedNotes = sanitizeText(escalationNotes).slice(0, 2000);

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("tickets")
        .update({ 
            status: "re_raised",
            proof_media_url: proofMediaUrl || null,
            resolution_notes: sanitizedNotes,
            updated_at: new Date().toISOString()
        })
        .eq("id", ticketId)
        .eq("assigned_to", uid) // Ensure the employee owns the ticket
        .eq("status", "in_progress") // ENFORCE: must be in progress first
        .eq("version", currentVersion)
        .select()
        .single();

    if (error || !data) {
        throw new Error("Failed to escalate. The ticket must be 'In Progress' first, or it has been updated elsewhere.");
    }
    await logAuditEvent({
        actorUid: uid,
        action: "ticket.escalate",
        resourceType: "ticket",
        resourceId: ticketId,
    });
    revalidatePath("/", "layout");
    return data;
}

/**
 * Employee marks their assigned ticket as "In Progress"
 * Enforces: employee must own the ticket, ticket must be in 'assigned' state.
 */
export async function markInProgressAction(idToken: string, ticketId: string, currentVersion: number) {
    const { role, uid } = await verifyUserRoleAction(idToken);
    if (role !== "employee") throw new Error("Unauthorized: Employee access required.");

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("tickets")
        .update({
            status: "in_progress",
            updated_at: new Date().toISOString()
        })
        .eq("id", ticketId)
        .eq("assigned_to", uid)
        .eq("status", "assigned")
        .eq("version", currentVersion)
        .select()
        .single();

    if (error || !data) {
        if (error) console.error("Supabase Error in markInProgress:", error);
        throw new Error("Failed to start work. The ticket may have been updated elsewhere.");
    }
    revalidatePath("/", "layout");
    return data;
}

/**
 * Admin manually closes any ticket regardless of current status.
 */
export async function adminCloseTicketAction(idToken: string, ticketId: string, currentVersion: number, adminNotes?: string) {
    const { role, uid } = await verifyUserRoleAction(idToken);
    if (role !== "admin") throw new Error("Unauthorized: Admin access required.");

    const sanitizedNotes = sanitizeText(adminNotes || "").slice(0, 2000);

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("tickets")
        .update({
            status: "closed",
            resolution_notes: sanitizedNotes || "Closed by admin.",
            updated_at: new Date().toISOString()
        })
        .eq("id", ticketId)
        .eq("version", currentVersion)
        .select()
        .single();

    if (error || !data) {
        throw new Error("Failed to close. The ticket may have been updated elsewhere.");
    }
    await logAuditEvent({
        actorUid: uid,
        action: "ticket.admin_close",
        resourceType: "ticket",
        resourceId: ticketId,
    });
    revalidatePath("/", "layout");
    return data;
}

/**
 * Admin assigns an existing open ticket to a specific engineer.
 */
export async function assignTicketToEmployeeAction(idToken: string, ticketId: string, employeeUid: string, currentVersion: number) {
    const { role, uid } = await verifyUserRoleAction(idToken);
    if (role !== "admin") throw new Error("Unauthorized: Admin access required.");

    if (!employeeUid?.trim()) throw new Error("Employee UID is required.");

    const supabase = createAdminClient();

    // Verify target employee exists in the employees table
    const { data: employeeExists } = await supabase
        .from("employees")
        .select("firebase_uid")
        .eq("firebase_uid", employeeUid)
        .maybeSingle();

    if (!employeeExists) {
        throw new Error("Cannot assign: the selected engineer does not exist in the system.");
    }

    const { data, error } = await supabase
        .from("tickets")
        .update({
            assigned_to: employeeUid,
            status: "assigned",
            updated_at: new Date().toISOString()
        })
        .eq("id", ticketId)
        .eq("version", currentVersion)
        .select()
        .single();

    if (error || !data) {
        throw new Error("Failed to assign. The ticket may have been updated elsewhere.");
    }
    await logAuditEvent({
        actorUid: uid,
        action: "ticket.assign",
        resourceType: "ticket",
        resourceId: ticketId,
        metadata: { employeeUid },
    });
    revalidatePath("/", "layout");

    // Trigger notification
   

    return data;
}

/**
 * Admin releases a ticket back to the open pool (unassigns it, resets media and notes).
 */
export async function adminReleaseTicketAction(idToken: string, ticketId: string, currentVersion: number) {
    const { role, uid } = await verifyUserRoleAction(idToken);
    if (role !== "admin") throw new Error("Unauthorized: Admin access required.");

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("tickets")
        .update({
            status: "open",
            assigned_to: null,
            proof_media_url: null,
            resolution_notes: null,
            updated_at: new Date().toISOString()
        })
        .eq("id", ticketId)
        .eq("version", currentVersion)
        .select()
        .single();

    if (error || !data) {
        throw new Error("Failed to release ticket. It may have been updated elsewhere.");
    }
    await logAuditEvent({
        actorUid: uid,
        action: "ticket.admin_release",
        resourceType: "ticket",
        resourceId: ticketId,
    });
    revalidatePath("/", "layout");
    return data;
}

/**
 * Employee checks in at the ATM location
 */
export async function checkInAction(idToken: string, ticketId: string, currentVersion: number, latitude: number, longitude: number) {
    const { role, uid } = await verifyUserRoleAction(idToken);
    if (role !== "employee") throw new Error("Unauthorized: Employee access required.");

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new Error("Valid coordinates are required.");
    }

    const supabase = createAdminClient();

    // 1. Insert check-in record
    const { data: checkIn, error: checkInError } = await supabase
        .from("check_ins")
        .insert([{
            ticket_id: ticketId,
            employee_id: uid,
            latitude,
            longitude,
            checked_in_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (checkInError) throw checkInError;

    // 2. Attempt to update ticket status to in_progress if it's currently assigned
    const { data: ticket } = await supabase
        .from("tickets")
        .update({
            status: "in_progress",
            updated_at: new Date().toISOString()
        })
        .eq("id", ticketId)
        .eq("assigned_to", uid)
        .eq("status", "assigned")
        .eq("version", currentVersion)
        .select()
        .maybeSingle();

    await logAuditEvent({
        actorUid: uid,
        action: "ticket.check_in",
        resourceType: "ticket",
        resourceId: ticketId,
        metadata: { latitude, longitude },
    });
    revalidatePath("/", "layout");
    
    return { success: true, checkIn, ticket: ticket || null };
}

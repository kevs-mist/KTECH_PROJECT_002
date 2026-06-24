import { verifyUserRoleAction } from "./authActions";
import { createAdminClient } from "../../../../utils/supabase/admin";
import { Ticket } from "../services/ticketService";
import { z } from "zod";
import { sanitizeText } from "../security/sanitizer";
import { revalidatePath } from "next/cache";

// Whitelist and Validation Schemas
const ticketCreateSchema = z.object({
    title: z.string().trim().min(5, "Title too short").max(200),
    description: z.string().trim().min(10, "Description too short").max(2000),
    issue_type: z.string().trim().min(2),
    atm_id: z.string().trim().min(2),
    bank_id: z.string().trim().min(2),
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
    console.log("getTicketsAction called with idToken");
    const { role, uid } = await verifyUserRoleAction(idToken);
    console.log("User role:", role, "UID:", uid);
    const supabase = createAdminClient();

    let query = supabase.from("tickets").select("*");

    if (role === "admin") {
        query = query.order("created_at", { ascending: false });
    } else if (role === "employee") {
        query = query
            .or(`assigned_to.eq.${uid},and(status.eq.open,assigned_to.is.null)`)
            .order("created_at", { ascending: false });
        console.log("Employee query:", `assigned_to.eq.${uid},and(status.eq.open,assigned_to.is.null)`);
    } else {
        query = query.eq("created_by", uid).order("created_at", { ascending: false });
        console.log("User query for created_by:", uid);
    }

    const { data, error } = await query;
    console.log("Query result - data:", data, "error:", error);
    if (error) throw error;
    return data;
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
    const { role } = await verifyUserRoleAction(idToken);
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
    revalidatePath("/", "layout");
    return data;
}

/**
 * Admin assigns an existing open ticket to a specific engineer.
 */
export async function assignTicketToEmployeeAction(idToken: string, ticketId: string, employeeUid: string, currentVersion: number) {
    const { role } = await verifyUserRoleAction(idToken);
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
    revalidatePath("/", "layout");
    return data;
}

/**
 * Admin releases a ticket back to the open pool (unassigns it, resets media and notes).
 */
export async function adminReleaseTicketAction(idToken: string, ticketId: string, currentVersion: number) {
    const { role } = await verifyUserRoleAction(idToken);
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
    revalidatePath("/", "layout");
    return data;
}

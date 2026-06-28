import { verifyUserRoleAction } from "./authActions";
import { createAdminClient } from "../../../../utils/supabase/admin";
import { Ticket } from "../services/ticketService";
import { z } from "zod";
import { sanitizeText } from "../security/sanitizer";
import { revalidatePath } from "next/cache";

import { logAuditEvent } from "../server/apiSecurity";
import { sendTicketVerification } from "../../../../utils/email";
import { notifyOnlineEmployeesAction, createNotificationAction } from "./notificationActions";

// Whitelist and Validation Schemas
const ticketCreateSchema = z.object({
    title: z.string().trim().min(5, "Title too short").max(200),
    description: z.string().min(3, "Description must be at least 3 characters"),
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

    // If the UI did not provide an assignee, try to auto-assign from ATM master data.
    // This keeps the ticket routed to the engineer already mapped to the ATM.
    let inferredAssignee: string | undefined = validatedData.assigned_to;
    if (!inferredAssignee && (validatedData.atm_location_id || validatedData.atm_id)) {
        const atmQuery = validatedData.atm_location_id
            ? supabase
                  .from("atm_locations")
                  .select("engineer_email")
                  .eq("id", validatedData.atm_location_id)
                  .maybeSingle()
            : supabase
                  .from("atm_locations")
                  .select("engineer_email")
                  .eq("atm_id", validatedData.atm_id)
                  .maybeSingle();

        const { data: atmRecord } = await atmQuery;

        if (atmRecord?.engineer_email) {
            const { data: mappedEngineer } = await supabase
                .from("users")
                .select("firebase_uid")
                .eq("email", atmRecord.engineer_email)
                .eq("role", "employee")
                .maybeSingle();

            if (mappedEngineer?.firebase_uid) {
                inferredAssignee = mappedEngineer.firebase_uid;
            }
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
        assigned_to: inferredAssignee,
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

    // Send email to assigned engineer (employee) - NOT to admin
    if (sanitizedData.assigned_to) {
        try {
            const { data: engineerData, error: engineerError } = await supabase
                .from("users")
                .select("email, full_name")
                .eq("firebase_uid", sanitizedData.assigned_to)
                .single();
            
            if (engineerError) {
                console.error("Error fetching engineer data:", engineerError);
            }
            
            if (engineerData?.email) {
                await sendTicketVerification(data, engineerData.email, engineerData.full_name);
            }
        } catch (engineerEmailError) {
            console.error("Failed to send ticket assignment email to engineer:", engineerEmailError);
        }
    }

    // Create in-app notification
    try {
        if (uid) {
            await createNotificationAction(
                uid,
                "ticket_updated",
                "Ticket Created",
                `Ticket "${validatedData.title}" was created successfully.${initialStatus === "assigned" ? " It has been auto-assigned." : " It is in the open pool."}`,
                data.id
            );
        }

        if (initialStatus === "open") {
            // Notify all online employees about new ticket in open pool
            await notifyOnlineEmployeesAction(
                "ticket_open_pool",
                "New Ticket Available",
                `A new ticket "${validatedData.title}" is now available in the open pool.`,
                data.id
            );
        } else if (sanitizedData.assigned_to) {
            // Notify the assigned employee
            await createNotificationAction(
                sanitizedData.assigned_to,
                "ticket_assigned",
                "Ticket Assigned to You",
                `You have been assigned ticket "${validatedData.title}".`,
                data.id
            );
        }
    } catch (notifError) {
        console.error("Failed to create notification:", notifError);
    }

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

    // Notify the assignee (the accepter) that they have accepted the ticket
    try {
        await createNotificationAction(
            uid,
            "ticket_accepted",
            "Ticket Accepted",
            `You have accepted ticket "${data.title}".`,
            data.id
        );
    } catch (notifError) {
        console.error("Failed to create acceptance notification:", notifError);
    }

    // Send email notification
    try {
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("email, full_name")
            .eq("firebase_uid", uid)
            .single();

        if (!userError && userData?.email) {
            await sendTicketVerification(data, userData.email, userData.full_name);
        }
    } catch (emailError) {
        console.error("Failed to send acceptance email:", emailError);
    }

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

    // Notify the assignee that their ticket has been resolved
    try {
        await createNotificationAction(
            uid,
            "ticket_resolved",
            "Ticket Resolved",
            `You have resolved ticket "${data.title}".`,
            data.id
        );
    } catch (notifError) {
        console.error("Failed to create resolution notification:", notifError);
    }

    // Send email notification
    try {
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("email, full_name")
            .eq("firebase_uid", uid)
            .single();

        if (!userError && userData?.email) {
            await sendTicketVerification(data, userData.email, userData.full_name);
        }
    } catch (emailError) {
        console.error("Failed to send resolution email:", emailError);
    }

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

    // Notify the assignee that their ticket has been escalated
    try {
        await createNotificationAction(
            uid,
            "ticket_escalated",
            "Ticket Escalated",
            `You have escalated ticket "${data.title}".`,
            data.id
        );
    } catch (notifError) {
        console.error("Failed to create escalation notification:", notifError);
    }

    // Send email notification
    try {
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("email, full_name")
            .eq("firebase_uid", uid)
            .single();

        if (!userError && userData?.email) {
            await sendTicketVerification(data, userData.email, userData.full_name);
        }
    } catch (emailError) {
        console.error("Failed to send escalation email:", emailError);
    }

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

    // Notify the assignee that their ticket is now in progress
    try {
        await createNotificationAction(
            uid,
            "ticket_in_progress",
            "Ticket In Progress",
            `You have started work on ticket "${data.title}".`,
            data.id
        );
    } catch (notifError) {
        console.error("Failed to create in-progress notification:", notifError);
    }

    // Send email notification
    try {
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("email, full_name")
            .eq("firebase_uid", uid)
            .single();

        if (!userError && userData?.email) {
            await sendTicketVerification(data, userData.email, userData.full_name);
        }
    } catch (emailError) {
        console.error("Failed to send in-progress email:", emailError);
    }

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

    // Notify the assignee (if any) that the admin has closed the ticket
    if (data.assigned_to) {
        try {
            await createNotificationAction(
                data.assigned_to,
                "ticket_closed",
                "Ticket Closed",
                `Ticket "${data.title}" has been closed by an administrator.`,
                data.id
            );
        } catch (notifError) {
            console.error("Failed to create close notification:", notifError);
        }
    }

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

    // Create notification for assigned employee
    try {
        await createNotificationAction(
            employeeUid,
            "ticket_assigned",
            "Ticket Assigned to You",
            `You have been assigned a new ticket. Please check your dashboard.`,
            ticketId
        );
    } catch (notifError) {
        console.error("Failed to create assignment notification:", notifError);
    }

    // Send email notification to assigned employee
    try {
        const { data: employeeData, error: employeeError } = await supabase
            .from("users")
            .select("email, full_name")
            .eq("firebase_uid", employeeUid)
            .single();

        if (!employeeError && employeeData?.email) {
            await sendTicketVerification(data, employeeData.email, employeeData.full_name);
        }
    } catch (emailError) {
        console.error("Failed to send assignment email:", emailError);
    }

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

    // Notify the previous assignee (if any) that their ticket has been released
    if (data.assigned_to) {
        try {
            await createNotificationAction(
                data.assigned_to,
                "ticket_released",
                "Ticket Released",
                `Ticket "${data.title}" has been released back to the open pool.`,
                data.id
            );
        } catch (notifError) {
            console.error("Failed to create release notification:", notifError);
        }
    }

    // Send email notification to previous assignee (if any)
    if (data.assigned_to) {
        try {
            const { data: assigneeData, error: assigneeError } = await supabase
                .from("users")
                .select("email, full_name")
                .eq("firebase_uid", data.assigned_to)
                .single();

            if (!assigneeError && assigneeData?.email) {
                await sendTicketVerification(data, assigneeData.email, assigneeData.full_name);
            }
        } catch (emailError) {
            console.error("Failed to send release email:", emailError);
        }
    }

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
    const { data: ticket, error: ticketError } = await supabase
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

    if (ticketError) throw ticketError;
    if (!ticket) {
        throw new Error("Failed to update ticket. It may have been updated elsewhere.");
    }

    await logAuditEvent({
        actorUid: uid,
        action: "ticket.check_in",
        resourceType: "ticket",
        resourceId: ticketId,
        metadata: { latitude, longitude },
    });
    revalidatePath("/", "layout");

    // Notify the assignee that someone has checked in at their ticket location
    if (ticket) {
        try {
            await createNotificationAction(
                ticket.assigned_to,
                "ticket_check_in",
                "Check-in at Ticket Location",
                `Someone has checked in at the location for ticket "${ticket.title}".`,
                ticket.id
            );
        } catch (notifError) {
            console.error("Failed to create check-in notification:", notifError);
        }
    }

    // Send email notification to assignee (if any)
    if (ticket && ticket.assigned_to) {
        try {
            const { data: assigneeData, error: assigneeError } = await supabase
                .from("users")
                .select("email, full_name")
                .eq("firebase_uid", ticket.assigned_to)
                .single();

            if (!assigneeError && assigneeData?.email) {
                // For check-in, we might want to send a different email template
                // But for now, we'll use the same ticket verification email
                await sendTicketVerification(ticket, assigneeData.email, assigneeData.full_name);
            }
        } catch (emailError) {
            console.error("Failed to send check-in email:", emailError);
        }
    }

    // Fetch the latest ticket state after check-in
    const { data: updatedTicket, error: fetchError } = await supabase
        .from("tickets")
        .select("*, check_ins(*)")
        .eq("id", ticketId)
        .single();

    if (fetchError) throw fetchError;

    return { success: true, checkIn, ticket: updatedTicket };
}


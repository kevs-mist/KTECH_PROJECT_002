import { verifyUserRoleAction } from "./authActions";
import { createAdminClient } from "../../../../utils/supabase/admin";
import { sanitizeText } from "../security/sanitizer";
import { z } from "zod";

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  ticket_id: string | null;
  is_read: boolean;
  created_at: string;
}

// Validation schemas
const notificationCreateSchema = z.object({
  recipientId: z.string().min(1).max(255),
  type: z.enum(["ticket_assigned", "ticket_open_pool", "ticket_updated"]),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  ticketId: z.string().uuid().optional(),
});

const notificationIdSchema = z.string().uuid();

/**
 * Get notifications for the current user
 */
export async function getNotificationsAction(idToken: string): Promise<Notification[]> {
  const { uid } = await verifyUserRoleAction(idToken);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

/**
 * Mark a notification as read
 */
export async function markNotificationReadAction(idToken: string, notificationId: string) {
  const { uid } = await verifyUserRoleAction(idToken);

  // Validate notification ID format
  const validatedId = notificationIdSchema.safeParse(notificationId);
  if (!validatedId.success) {
    throw new Error("Invalid notification ID");
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", validatedId.data)
    .eq("recipient_id", uid);

  if (error) throw error;
}

/**
 * Mark all notifications as read for the current user
 */
export async function markAllNotificationsReadAction(idToken: string) {
  const { uid } = await verifyUserRoleAction(idToken);

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_id", uid)
    .eq("is_read", false);

  if (error) throw error;
}

/**
 * Create a notification for a recipient
 * This is called by backend services (ticket creation, assignment, etc.)
 * Requires admin role authorization
 */
export async function createNotificationAction(
  recipientId: string,
  type: "ticket_assigned" | "ticket_open_pool" | "ticket_updated",
  title: string,
  message: string,
  ticketId?: string
) {
  const supabase = createAdminClient();

  // Validate input
  const validatedData = notificationCreateSchema.safeParse({
    recipientId,
    type,
    title,
    message,
    ticketId,
  });

  if (!validatedData.success) {
    console.error("Invalid notification data:", validatedData.error);
    return;
  }

  // Verify recipient exists in users table
  const { data: recipientExists } = await supabase
    .from("users")
    .select("firebase_uid")
    .eq("firebase_uid", validatedData.data.recipientId)
    .maybeSingle();

  if (!recipientExists) {
    console.error("Notification recipient does not exist:", validatedData.data.recipientId);
    return;
  }

  // Rate limiting: Check if recipient has too many recent notifications (prevent spam)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", validatedData.data.recipientId)
    .gte("created_at", oneHourAgo);

  if (count && count >= 50) {
    console.error("Rate limit exceeded for recipient:", validatedData.data.recipientId);
    return;
  }

  // Sanitize text inputs to prevent XSS
  const sanitizedData = {
    recipient_id: validatedData.data.recipientId,
    type: validatedData.data.type,
    title: sanitizeText(validatedData.data.title),
    message: sanitizeText(validatedData.data.message),
    ticket_id: validatedData.data.ticketId || null,
  };

  const { error } = await supabase
    .from("notifications")
    .insert(sanitizedData);

  if (error) console.error("Error creating notification:", error);
}

/**
 * Create notifications for all online employees (for open pool tickets)
 * This should only be called by authorized backend services
 */
export async function notifyOnlineEmployeesAction(
  type: "ticket_open_pool",
  title: string,
  message: string,
  ticketId?: string
) {
  const supabase = createAdminClient();

  // Validate inputs
  const validatedData = notificationCreateSchema.omit({ recipientId: true }).safeParse({
    type,
    title,
    message,
    ticketId,
  });

  if (!validatedData.success) {
    console.error("Invalid notification data for online employees:", validatedData.error);
    return;
  }

  // Get all online employees (limit to prevent abuse)
  const { data: employees, error } = await supabase
    .from("employees")
    .select("firebase_uid")
    .eq("is_online", true)
    .eq("status", "active")
    .limit(100); // Prevent mass notification spam

  if (error) {
    console.error("Error fetching online employees:", error);
    return;
  }

  if (!employees || employees.length === 0) {
    return;
  }

  // Create notification for each online employee
  for (const employee of employees) {
    await createNotificationAction(
      employee.firebase_uid,
      validatedData.data.type,
      validatedData.data.title,
      validatedData.data.message,
      validatedData.data.ticketId
    );
  }
}

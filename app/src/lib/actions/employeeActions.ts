import { verifyUserRoleAction } from "./authActions";
import { createAdminClient } from "../../../../utils/supabase/admin";
import { sendEmployeeVerification } from "../../../../utils/email";

export interface EmployeeProfile {
    firebase_uid: string;
    employee_id: string;
    full_name: string | null;
    email: string;
    department: string | null;
    status: "active" | "on_leave" | "terminated";
    joined_at: string;
    is_online: boolean;
    last_seen: string;
    active_tickets: number;
    closed_tickets: number;
}

/**
 * Returns all employee profiles with live ticket counts.
 * Admin only.
 */
export async function getEmployeesAction(idToken: string): Promise<EmployeeProfile[]> {
    const { role } = await verifyUserRoleAction(idToken);
    if (role !== "admin") throw new Error("Unauthorized: Admin access required.");

    const supabase = createAdminClient();

    // 1. Fetch all employees joined with users for name/email
    const { data: employees, error } = await supabase
        .from("employees")
        .select(`
            firebase_uid,
            employee_id,
            department,
            status,
            joined_at,
            is_online,
            last_seen,
            users!employees_firebase_uid_fkey (
                email,
                full_name
            )
        `)
        .order("joined_at", { ascending: true });

    if (error) throw error;
    if (!employees || employees.length === 0) return [];

    // 2. Fetch ticket counts per employee
    const uids = employees.map(e => e.firebase_uid);

    const { data: activeTickets } = await supabase
        .from("tickets")
        .select("assigned_to")
        .in("assigned_to", uids)
        .in("status", ["assigned", "in_progress"]);

    const { data: closedTickets } = await supabase
        .from("tickets")
        .select("assigned_to")
        .in("assigned_to", uids)
        .eq("status", "closed");

    // 3. Build count maps
    const activeCounts: Record<string, number> = {};
    const closedCounts: Record<string, number> = {};

    (activeTickets || []).forEach(t => {
        if (t.assigned_to) activeCounts[t.assigned_to] = (activeCounts[t.assigned_to] || 0) + 1;
    });
    (closedTickets || []).forEach(t => {
        if (t.assigned_to) closedCounts[t.assigned_to] = (closedCounts[t.assigned_to] || 0) + 1;
    });

    // 4. Shape the response
    return employees.map(emp => {
        const userInfo = Array.isArray(emp.users) ? emp.users[0] : emp.users;
        return {
            firebase_uid: emp.firebase_uid,
            employee_id: emp.employee_id,
            full_name: userInfo?.full_name ?? null,
            email: userInfo?.email ?? "",
            department: emp.department ?? null,
            status: emp.status as EmployeeProfile["status"],
            joined_at: emp.joined_at,
            is_online: !!emp.is_online,
            last_seen: emp.last_seen,
            active_tickets: activeCounts[emp.firebase_uid] || 0,
            closed_tickets: closedCounts[emp.firebase_uid] || 0,
        };
    });
}

/**
 * Updates the online status of an employee.
 * Only employees can update their own online status.
 */
export async function setEmployeeOnlineStatusAction(idToken: string, isOnline: boolean) {
    const { role, uid } = await verifyUserRoleAction(idToken);
    if (role !== "employee") {
        console.log("Online status update ignored: user is not an employee");
        return;
    }

    const supabase = createAdminClient();
    
    // First, verify the employee exists and is active
    const { data: employee } = await supabase
        .from("employees")
        .select("status")
        .eq("firebase_uid", uid)
        .single();

    if (!employee || employee.status !== "active") {
        console.log("Online status update ignored: employee not found or not active");
        return;
    }

    const { error } = await supabase
        .from("employees")
        .update({
            is_online: isOnline,
            last_seen: new Date().toISOString()
        })
        .eq("firebase_uid", uid);

    if (error) console.error("Error updating online status:", error);
}

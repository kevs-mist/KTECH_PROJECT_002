import { auth } from "../firebase";

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

export const employeeService = {
    async getIdToken() {
        const token = await auth.currentUser?.getIdToken(true);
        if (!token) throw new Error("Unauthorized: Please log in again.");
        return token;
    },

    async request(path: string, init: RequestInit = {}) {
        const token = await this.getIdToken();
        const response = await fetch(path, {
            ...init,
            headers: {
                ...(init.headers || {}),
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || "Employee request failed.");
        return data;
    },

    async getEmployees(): Promise<EmployeeProfile[]> {
        return this.request("/api/employees");
    },

    async setOnlineStatus(isOnline: boolean) {
        return this.request("/api/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "online-status", isOnline }),
        });
    }
};

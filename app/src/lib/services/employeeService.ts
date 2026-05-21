import { auth } from "../firebase";
import { parseJsonResponse } from "../apiClient";

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

    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const token = await this.getIdToken();
        const response = await fetch(path, {
            ...init,
            headers: {
                ...(init.headers || {}),
                Authorization: `Bearer ${token}`,
            },
        });
        return parseJsonResponse<T>(response, path);
    },

    async getEmployees(): Promise<EmployeeProfile[]> {
        return this.request<EmployeeProfile[]>("/api/employees");
    },

    async setOnlineStatus(isOnline: boolean): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>("/api/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "online-status", isOnline }),
        });
    }
};

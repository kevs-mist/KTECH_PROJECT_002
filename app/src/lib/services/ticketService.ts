import { auth } from "../firebase";

export interface Ticket {
    id?: string;
    ticket_no?: string;
    title: string;
    description: string;
    issue_type: string;
    status?: string;
    atm_id: string;
    bank_id: string;
    atm_location: string;
    bank_location?: string;
    assigned_to?: string;
    created_by: string;
    created_at?: string;
    updated_at?: string;
    proof_media_url?: string;
    resolution_notes?: string;
    priority?: string;
    version?: number; // For optimistic locking
}

export const ticketService = {
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
        if (!response.ok || data.error) throw new Error(data.error || "Ticket request failed.");
        return data;
    },

    async post(operation: string, payload: Record<string, unknown>) {
        return this.request("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation, ...payload }),
        });
    },

    async createTicket(ticket: Ticket) {
        return this.post("create", { ticket });
    },

    async getAllTickets() {
        return this.request("/api/tickets");
    },

    async getEmployeeTickets() {
        return this.request("/api/tickets");
    },

    async getAdminStats() {
        return this.request("/api/tickets?resource=admin-stats");
    },

    async acceptTicket(ticketId: string, _employeeUid: string, currentVersion: number) {
        return this.post("accept", { ticketId, currentVersion });
    },

    async resolveTicket(ticketId: string, currentVersion: number, proofMediaUrl: string, resolutionNotes?: string) {
        return this.post("resolve", { ticketId, currentVersion, proofMediaUrl, resolutionNotes });
    },

    async escalateTicket(ticketId: string, currentVersion: number, proofMediaUrl?: string, escalationNotes?: string) {
        return this.post("escalate", { ticketId, currentVersion, proofMediaUrl, escalationNotes });
    },

    async markInProgress(ticketId: string, currentVersion: number) {
        return this.post("mark-in-progress", { ticketId, currentVersion });
    },

    async adminCloseTicket(ticketId: string, currentVersion: number, adminNotes?: string) {
        return this.post("admin-close", { ticketId, currentVersion, adminNotes });
    },

    async assignToEmployee(ticketId: string, employeeUid: string, currentVersion: number) {
        return this.post("assign", { ticketId, employeeUid, currentVersion });
    },

    async adminReleaseTicket(ticketId: string, currentVersion: number) {
        return this.post("admin-release", { ticketId, currentVersion });
    }
};

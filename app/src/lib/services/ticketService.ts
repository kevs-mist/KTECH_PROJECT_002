"use client";
import { auth } from "../firebase";
import { parseJsonResponse } from "../apiClient";

export interface Ticket {
    id?: string;
    ticket_no?: string;
    title: string;
    description: string;
    issue_type: string;
    status?: string;
    atm_id: string;
    atm_location_id?: string;
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
    version?: number;
    check_ins?: any[];
}

interface AdminStats {
    total: number;
    open: number;
    closed: number;
    escalated: number;
}

// Returned when user types an ATM ID — shows who will be auto-assigned
export interface AtmEngineerPreview {
    engineer_name: string | null;
    engineer_email: string;
    engineer_contact: string | null;
    engineer_id: string | null; // firebase_uid
    method: "atm_assigned";
}

export const ticketService = {

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

    async post<T>(operation: string, payload: Record<string, unknown>): Promise<T> {
        return this.request<T>("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation, ...payload }),
        });
    },

    // ── Ticket CRUD ───────────────────────────────────────────────────────────
    // Auto-assignment happens server-side in the route.
    // Just pass the ticket with atm_id — the route looks up the engineer
    // from atm_locations and sets assigned_to + status automatically.

    async createTicket(ticket: Ticket): Promise<Ticket> {
        return this.post<Ticket>("create", { ticket });
    },

    async getAllTickets(): Promise<Ticket[]> {
        return this.request<Ticket[]>("/api/tickets");
    },

    async getEmployeeTickets(): Promise<Ticket[]> {
        return this.request<Ticket[]>("/api/tickets");
    },

    async getAdminStats(): Promise<AdminStats> {
        return this.request<AdminStats>("/api/tickets?resource=admin-stats");
    },

    // ── Preview assigned engineer before creating ticket ──────────────────────
    // Call this when the user finishes typing the ATM ID.
    // Shows "This ticket will be assigned to Mayur Gor" in the UI.
    async getAssignedEngineer(atmId: string): Promise<AtmEngineerPreview | null> {
        try {
            const result = await this.request<{ success: boolean; data: AtmEngineerPreview }>(
                "/api/atm/nearest",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ atmId }),
                }
            );
            return result.success ? result.data : null;
        } catch {
            return null; // ATM not found or no engineer assigned — fail silently
        }
    },

    // ── Ticket actions ────────────────────────────────────────────────────────

    async acceptTicket(ticketId: string, _employeeUid: string, currentVersion: number): Promise<Ticket> {
        return this.post<Ticket>("accept", { ticketId, currentVersion });
    },

    async resolveTicket(ticketId: string, currentVersion: number, proofMediaUrl: string, resolutionNotes?: string): Promise<Ticket> {
        return this.post<Ticket>("resolve", { ticketId, currentVersion, proofMediaUrl, resolutionNotes });
    },

    async escalateTicket(ticketId: string, currentVersion: number, proofMediaUrl?: string, escalationNotes?: string): Promise<Ticket> {
        return this.post<Ticket>("escalate", { ticketId, currentVersion, proofMediaUrl, escalationNotes });
    },

    async markInProgress(ticketId: string, currentVersion: number): Promise<Ticket> {
        return this.post<Ticket>("mark-in-progress", { ticketId, currentVersion });
    },

    async adminCloseTicket(ticketId: string, currentVersion: number, adminNotes?: string): Promise<Ticket> {
        return this.post<Ticket>("admin-close", { ticketId, currentVersion, adminNotes });
    },

    async assignToEmployee(ticketId: string, employeeUid: string, currentVersion: number): Promise<Ticket> {
        return this.post<Ticket>("assign", { ticketId, employeeUid, currentVersion });
    },

    async adminReleaseTicket(ticketId: string, currentVersion: number): Promise<Ticket> {
        return this.post<Ticket>("admin-release", { ticketId, currentVersion });
    },

    async checkIn(ticketId: string, currentVersion: number, latitude: number, longitude: number): Promise<{ success: boolean; checkIn: any; ticket: Ticket | null }> {
        return this.post<{ success: boolean; checkIn: any; ticket: Ticket | null }>(
            "check-in",
            { ticketId, currentVersion, latitude, longitude }
        );
    },
};
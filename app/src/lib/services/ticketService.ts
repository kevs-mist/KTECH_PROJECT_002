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
    version?: number; // For optimistic locking
    check_ins?: any[]; // Check-ins array from DB
}

interface AdminStats {
    total: number;
    open: number;
    closed: number;
    escalated: number;
}

// Client-side token cache to reduce Firebase Auth API calls
let cachedToken: string | null = null;
let tokenExpiry: number = 0;
const TOKEN_CACHE_DURATION = 55 * 60 * 1000; // 55 minutes (Firebase tokens last 1 hour)

export const ticketService = {
    async getIdToken() {
        // Check if we have a valid cached token
        const now = Date.now();
        if (cachedToken && tokenExpiry > now) {
            return cachedToken;
        }

        // Force refresh only if cache is expired
        const forceRefresh = !cachedToken || tokenExpiry <= now;
        
        try {
            const token = await auth.currentUser?.getIdToken(forceRefresh);
            if (!token) throw new Error("Unauthorized: Please log in again.");
            
            // Cache the token
            cachedToken = token;
            tokenExpiry = now + TOKEN_CACHE_DURATION;
            
            return token;
        } catch (error: any) {
            // Clear cache on error to force refresh on next attempt
            cachedToken = null;
            tokenExpiry = 0;
            
            if (error?.code === 'auth/quota-exceeded') {
                throw new Error("Authentication quota exceeded. Please wait a moment and try again.");
            }
            throw error;
        }
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

    async checkIn(ticketId: string, currentVersion: number, latitude: number, longitude: number): Promise<{ success: boolean, checkIn: any, ticket: Ticket | null }> {
        return this.post<{ success: boolean, checkIn: any, ticket: Ticket | null }>("check-in", { ticketId, currentVersion, latitude, longitude });
    }
};

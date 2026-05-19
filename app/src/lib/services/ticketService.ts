import { auth } from "../firebase";
import { 
    getTicketsAction, 
    createTicketAction, 
    acceptTicketAction, 
    getAdminStatsAction,
    resolveTicketAction,
    escalateTicketAction,
    markInProgressAction,
    adminCloseTicketAction,
    assignTicketToEmployeeAction,
    adminReleaseTicketAction
} from "../actions/ticketActions";

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

/**
 * Ticket Service (Client Side)
 * Now routes through secure Server Actions.
 */
export const ticketService = {
    async getIdToken() {
        const token = await auth.currentUser?.getIdToken(true);
        if (!token) throw new Error("Unauthorized: Please log in again.");
        return token;
    },

    async createTicket(ticket: Ticket) {
        const token = await this.getIdToken();
        return createTicketAction(token, ticket);
    },

    async getAllTickets() {
        const token = await this.getIdToken();
        return getTicketsAction(token);
    },

    async getEmployeeTickets() {
        const token = await this.getIdToken();
        return getTicketsAction(token);
    },

    async getAdminStats() {
        const token = await this.getIdToken();
        return getAdminStatsAction(token);
    },

    async acceptTicket(ticketId: string, employeeUid: string, currentVersion: number) {
        const token = await this.getIdToken();
        return acceptTicketAction(token, ticketId, currentVersion);
    },

    async resolveTicket(ticketId: string, currentVersion: number, proofMediaUrl: string, resolutionNotes?: string) {
        const token = await this.getIdToken();
        return resolveTicketAction(token, ticketId, currentVersion, proofMediaUrl, resolutionNotes);
    },

    async escalateTicket(ticketId: string, currentVersion: number, proofMediaUrl?: string, escalationNotes?: string) {
        const token = await this.getIdToken();
        return escalateTicketAction(token, ticketId, currentVersion, proofMediaUrl, escalationNotes);
    },

    async markInProgress(ticketId: string, currentVersion: number) {
        const token = await this.getIdToken();
        return markInProgressAction(token, ticketId, currentVersion);
    },

    async adminCloseTicket(ticketId: string, currentVersion: number, adminNotes?: string) {
        const token = await this.getIdToken();
        return adminCloseTicketAction(token, ticketId, currentVersion, adminNotes);
    },

    async assignToEmployee(ticketId: string, employeeUid: string, currentVersion: number) {
        const token = await this.getIdToken();
        return assignTicketToEmployeeAction(token, ticketId, employeeUid, currentVersion);
    },

    async adminReleaseTicket(ticketId: string, currentVersion: number) {
        const token = await this.getIdToken();
        return adminReleaseTicketAction(token, ticketId, currentVersion);
    }
};

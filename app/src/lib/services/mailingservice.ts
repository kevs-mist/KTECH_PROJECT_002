import "server-only";
import { Resend } from "resend";
import type { EmployeeProfile } from "./employeeService";
import type { Ticket } from "./ticketService";

// ─── Resend client ────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Core send ────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
        console.error(`[MailingService] Invalid email address: ${to}`);
        return;
    }

    const { error } = await resend.emails.send({
        from: process.env.SMTP_FROM ?? "ATM Support <no-reply@mahienterprise.net.in>",
        to,
        subject,
        html,
    });

    if (error) {
        throw new Error(`Resend error: ${error.message}`);
    }
}

// ─── HTML Layout ──────────────────────────────────────────────────────────────

function baseLayout(title: string, body: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1d4ed8; color: #ffffff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { padding: 32px; color: #374151; line-height: 1.6; }
    .body p { margin: 0 0 16px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge-open      { background: #dbeafe; color: #1d4ed8; }
    .badge-assigned  { background: #ede9fe; color: #5b21b6; }
    .badge-progress  { background: #fef3c7; color: #92400e; }
    .badge-resolved  { background: #d1fae5; color: #065f46; }
    .badge-escalated { background: #fee2e2; color: #991b1b; }
    .badge-closed    { background: #e5e7eb; color: #374151; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .info-table td { padding: 8px 0; vertical-align: top; }
    .info-table td:first-child { font-weight: 600; color: #6b7280; width: 160px; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .footer { background: #f9fafb; padding: 16px 32px; font-size: 12px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>ATM Support — Ticket Notification</h1></div>
    <div class="body">${body}</div>
    <div class="footer">This is an automated notification. Please do not reply to this email.</div>
  </div>
</body>
</html>`.trim();
}

function statusBadge(status: string): string {
    const map: Record<string, string> = {
        open:        "badge-open",
        assigned:    "badge-assigned",
        in_progress: "badge-progress",
        resolved:    "badge-resolved",
        escalated:   "badge-escalated",
        closed:      "badge-closed",
    };
    const cls = map[status?.toLowerCase()] ?? "badge-open";
    return `<span class="badge ${cls}">${status ?? "open"}</span>`;
}

function ticketInfoTable(ticket: Ticket): string {
    return `
    <table class="info-table">
      <tr><td>Ticket No.</td><td>${ticket.ticket_no ?? ticket.id ?? "—"}</td></tr>
      <tr><td>Title</td><td>${ticket.title}</td></tr>
      <tr><td>Issue Type</td><td>${ticket.issue_type}</td></tr>
      <tr><td>Priority</td><td>${ticket.priority ?? "Normal"}</td></tr>
      <tr><td>Status</td><td>${statusBadge(ticket.status ?? "open")}</td></tr>
      <tr><td>ATM Location</td><td>${ticket.atm_location}</td></tr>
      <tr><td>Bank Location</td><td>${ticket.bank_location ?? "—"}</td></tr>
    </table>`;
}

// ─── Notification event type ──────────────────────────────────────────────────

export type NotificationEvent =
    | "ticket_assigned"
    | "ticket_accepted"
    | "ticket_in_progress"
    | "ticket_resolved"
    | "ticket_escalated"
    | "ticket_closed"
    | "ticket_released"
    | "ticket_created";

// ─── MailingService ───────────────────────────────────────────────────────────

export class MailingService {

    // ── Internal send with error guard ─────────────────────────────────────
    private async send(to: string, subject: string, html: string): Promise<void> {
        try {
            await sendEmail(to, subject, html);
        } catch (err) {
            console.error(`[MailingService] Failed to send "${subject}" to ${to}:`, err);
        }
    }

    // ── Event router ────────────────────────────────────────────────────────
    async notify(
        event: NotificationEvent,
        ticket: Ticket,
        employee?: EmployeeProfile | null,
    ): Promise<void> {
        switch (event) {
            case "ticket_assigned":
                if (employee) await this.sendTicketAssigned(ticket, employee);
                break;
            case "ticket_accepted":
                if (employee) await this.sendTicketAccepted(ticket, employee);
                break;
            case "ticket_in_progress":
                if (employee) await this.sendTicketInProgress(ticket, employee);
                break;
            case "ticket_resolved":
                if (employee) await this.sendTicketResolved(ticket, employee);
                break;
            case "ticket_escalated":
                if (employee) await this.sendTicketEscalated(ticket, employee);
                break;
            case "ticket_closed":
                if (employee) await this.sendTicketClosed(ticket, employee);
                break;
            case "ticket_released":
                if (employee) await this.sendTicketReleased(ticket, employee);
                break;
            case "ticket_created":
                await this.sendTicketCreated(ticket);
                break;
        }
    }

    // ── 1. Assigned ─────────────────────────────────────────────────────────
    async sendTicketAssigned(ticket: Ticket, employee: EmployeeProfile): Promise<void> {
        const name = employee.full_name ?? "Team Member";
        const html = baseLayout("New Ticket Assigned", `
            <p>Dear <strong>${name}</strong>,</p>
            <p>A new ticket has been assigned to you. Please review the details below and take action at your earliest convenience.</p>
            ${ticketInfoTable(ticket)}
            <hr class="divider"/>
            <p>Please log in to your dashboard to accept and begin working on this ticket.</p>
            <p>Best regards,<br/><strong>ATM Support Team</strong></p>
        `);
        await this.send(employee.email, `[New Assignment] Ticket ${ticket.ticket_no ?? ticket.id}`, html);
    }

    // ── 2. Accepted ─────────────────────────────────────────────────────────
    async sendTicketAccepted(ticket: Ticket, employee: EmployeeProfile): Promise<void> {
        const name = employee.full_name ?? "Team Member";
        const html = baseLayout("Ticket Accepted", `
            <p>Dear <strong>${name}</strong>,</p>
            <p>You have successfully <strong>accepted</strong> the following ticket.</p>
            ${ticketInfoTable(ticket)}
            <hr class="divider"/>
            <p>Remember to mark it <em>In Progress</em> once you begin work.</p>
            <p>Best regards,<br/><strong>ATM Support Team</strong></p>
        `);
        await this.send(employee.email, `[Accepted] Ticket ${ticket.ticket_no ?? ticket.id}`, html);
    }

    // ── 3. In Progress ──────────────────────────────────────────────────────
    async sendTicketInProgress(ticket: Ticket, employee: EmployeeProfile): Promise<void> {
        const name = employee.full_name ?? "Team Member";
        const html = baseLayout("Ticket Now In Progress", `
            <p>Dear <strong>${name}</strong>,</p>
            <p>The following ticket has been marked as <strong>In Progress</strong>.</p>
            ${ticketInfoTable(ticket)}
            <hr class="divider"/>
            <p>Once resolved, please upload proof media and submit your resolution notes.</p>
            <p>Best regards,<br/><strong>ATM Support Team</strong></p>
        `);
        await this.send(employee.email, `[In Progress] Ticket ${ticket.ticket_no ?? ticket.id}`, html);
    }

    // ── 4. Resolved ─────────────────────────────────────────────────────────
    async sendTicketResolved(ticket: Ticket, employee: EmployeeProfile): Promise<void> {
        const name = employee.full_name ?? "Team Member";
        const html = baseLayout("Ticket Resolved", `
            <p>Dear <strong>${name}</strong>,</p>
            <p>Great work! The following ticket has been marked as <strong>Resolved</strong>.</p>
            ${ticketInfoTable(ticket)}
            ${ticket.resolution_notes ? `<p><strong>Resolution Notes:</strong><br/>${ticket.resolution_notes}</p>` : ""}
            <hr class="divider"/>
            <p>The ticket is now pending admin review before it is officially closed.</p>
            <p>Best regards,<br/><strong>ATM Support Team</strong></p>
        `);
        await this.send(employee.email, `[Resolved] Ticket ${ticket.ticket_no ?? ticket.id}`, html);
    }

    // ── 5. Escalated ────────────────────────────────────────────────────────
    async sendTicketEscalated(ticket: Ticket, employee: EmployeeProfile): Promise<void> {
        const name = employee.full_name ?? "Team Member";
        const html = baseLayout("Ticket Escalated", `
            <p>Dear <strong>${name}</strong>,</p>
            <p>The following ticket has been <strong>escalated</strong> and requires urgent admin attention.</p>
            ${ticketInfoTable(ticket)}
            ${ticket.resolution_notes ? `<p><strong>Escalation Notes:</strong><br/>${ticket.resolution_notes}</p>` : ""}
            <hr class="divider"/>
            <p>An admin has been notified and will follow up shortly.</p>
            <p>Best regards,<br/><strong>ATM Support Team</strong></p>
        `);
        await this.send(employee.email, `[ESCALATED] Ticket ${ticket.ticket_no ?? ticket.id}`, html);
    }

    // ── 6. Closed ───────────────────────────────────────────────────────────
    async sendTicketClosed(ticket: Ticket, employee: EmployeeProfile): Promise<void> {
        const name = employee.full_name ?? "Team Member";
        const html = baseLayout("Ticket Closed", `
            <p>Dear <strong>${name}</strong>,</p>
            <p>The following ticket has been officially <strong>closed</strong> by an admin.</p>
            ${ticketInfoTable(ticket)}
            <hr class="divider"/>
            <p>No further action is required. Thank you for your efforts.</p>
            <p>Best regards,<br/><strong>ATM Support Team</strong></p>
        `);
        await this.send(employee.email, `[Closed] Ticket ${ticket.ticket_no ?? ticket.id}`, html);
    }

    // ── 7. Released ─────────────────────────────────────────────────────────
    async sendTicketReleased(ticket: Ticket, employee: EmployeeProfile): Promise<void> {
        const name = employee.full_name ?? "Team Member";
        const html = baseLayout("Ticket Released", `
            <p>Dear <strong>${name}</strong>,</p>
            <p>The following ticket has been <strong>released</strong> from your queue by an admin.</p>
            ${ticketInfoTable(ticket)}
            <hr class="divider"/>
            <p>No further action is required from you for this ticket.</p>
            <p>Best regards,<br/><strong>ATM Support Team</strong></p>
        `);
        await this.send(employee.email, `[Released] Ticket ${ticket.ticket_no ?? ticket.id}`, html);
    }

    // ── 8. Created ──────────────────────────────────────────────────────────
    async sendTicketCreated(ticket: Ticket, creatorEmail?: string): Promise<void> {
        const to = creatorEmail ?? "";
        if (!to) return;
        const html = baseLayout("Ticket Created Successfully", `
            <p>Your ticket has been <strong>created successfully</strong> and is now in the queue.</p>
            ${ticketInfoTable(ticket)}
            <hr class="divider"/>
            <p>You will receive updates as the ticket progresses.</p>
            <p>Best regards,<br/><strong>ATM Support Team</strong></p>
        `);
        await this.send(to, `[Created] Ticket ${ticket.ticket_no ?? ticket.id}`, html);
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const mailingService = new MailingService();
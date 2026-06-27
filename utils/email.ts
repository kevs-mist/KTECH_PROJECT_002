import nodemailer from "nodemailer";
import { EmployeeProfile } from "../app/src/lib/services/employeeService";
import { Ticket } from "../app/src/lib/services/ticketService";

// ─── Transporter ──────────────────────────────────────────────────────────────
// Reads credentials from environment variables — never hardcode these.
// Add to your .env.local:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_USER=you@yourdomain.com
//   SMTP_PASS=your_app_password
//   SMTP_FROM="ATM Support <no-reply@yourdomain.com>"

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465, // true for 465, false for 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// ─── Core Send ────────────────────────────────────────────────────────────────

export async function sendEmail(
    to: string,
    subject: string,
    html: string
): Promise<void> {
    await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to,
        subject,
        html,
    });
}

// ─── HTML Layout ──────────────────────────────────────────────────────────────

function buildHtml(title: string, body: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1d4ed8; color: #fff; padding: 24px 32px; }
    .header h2 { margin: 0; font-size: 18px; font-weight: 600; }
    .body { padding: 28px 32px; color: #374151; line-height: 1.7; font-size: 14px; }
    .body p { margin: 0 0 14px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px 20px; margin: 16px 0; }
    .info-box table { width: 100%; border-collapse: collapse; }
    .info-box td { padding: 5px 0; font-size: 13px; vertical-align: top; }
    .info-box td:first-child { font-weight: 600; color: #6b7280; width: 140px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-active     { background: #d1fae5; color: #065f46; }
    .badge-on_leave   { background: #fef3c7; color: #92400e; }
    .badge-terminated { background: #fee2e2; color: #991b1b; }
    .badge-open       { background: #dbeafe; color: #1d4ed8; }
    .badge-in_progress{ background: #fef3c7; color: #92400e; }
    .badge-resolved   { background: #d1fae5; color: #065f46; }
    .badge-escalated  { background: #fee2e2; color: #991b1b; }
    .badge-closed     { background: #e5e7eb; color: #374151; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 14px 32px; font-size: 11px; color: #9ca3af; text-align: center; }
    .highlight { color: #1d4ed8; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h2>ATM Support System — ${title}</h2></div>
    <div class="body">${body}</div>
    <div class="footer">This is an automated notification. Do not reply to this email.</div>
  </div>
</body>
</html>`.trim();
}

// ─── 1. Employee Verification ─────────────────────────────────────────────────
// Call after creating a new employee account.

export async function sendEmployeeVerification(
    employee: EmployeeProfile,
    verificationLink: string
): Promise<void> {
    const name = employee.full_name ?? "Team Member";

    const body = `
        <p>Dear <strong>${name}</strong>,</p>
        <p>Your employee account has been created. Please verify your identity to activate your account.</p>
        <div class="info-box">
            <table>
                <tr><td>Employee ID</td><td>${employee.employee_id}</td></tr>
                <tr><td>Email</td><td>${employee.email}</td></tr>
                <tr><td>Department</td><td>${employee.department ?? "—"}</td></tr>
                <tr><td>Status</td><td><span class="badge badge-${employee.status}">${employee.status}</span></td></tr>
                <tr><td>Joined</td><td>${new Date(employee.joined_at).toDateString()}</td></tr>
            </table>
        </div>
        <p>Click the link below to verify your account:</p>
        <p><a href="${verificationLink}" class="highlight">${verificationLink}</a></p>
        <p style="color:#9ca3af;font-size:12px;">This link expires in 24 hours. If you did not create this account, contact your administrator immediately.</p>
        <hr class="divider"/>
        <p>Best regards,<br/><strong>ATM Support Team</strong></p>
    `;

    await sendEmail(
        employee.email,
        "Verify Your Employee Account — ATM Support System",
        buildHtml("Employee Verification", body)
    );
}

// ─── 2. Route Verification ────────────────────────────────────────────────────
// Call when an employee is assigned a new route or ATM location.

export interface RouteDetails {
    routeId: string;
    atmId: string;
    atmLocation: string;
    bankLocation: string;
    scheduledDate: string;
    estimatedDuration?: string;
    specialInstructions?: string;
}

export async function sendRouteVerification(
    employee: EmployeeProfile,
    route: RouteDetails
): Promise<void> {
    const name = employee.full_name ?? "Team Member";

    const body = `
        <p>Dear <strong>${name}</strong>,</p>
        <p>A route has been assigned to you. Please review the details and confirm your availability before the scheduled date.</p>
        <div class="info-box">
            <table>
                <tr><td>Route ID</td><td>${route.routeId}</td></tr>
                <tr><td>ATM ID</td><td>${route.atmId}</td></tr>
                <tr><td>ATM Location</td><td>${route.atmLocation}</td></tr>
                <tr><td>Bank Location</td><td>${route.bankLocation}</td></tr>
                <tr><td>Scheduled Date</td><td>${new Date(route.scheduledDate).toDateString()}</td></tr>
                ${route.estimatedDuration ? `<tr><td>Est. Duration</td><td>${route.estimatedDuration}</td></tr>` : ""}
                ${route.specialInstructions ? `<tr><td>Instructions</td><td>${route.specialInstructions}</td></tr>` : ""}
            </table>
        </div>
        <p>Log in to your dashboard to confirm this route. If you are unable to fulfil it, notify your supervisor immediately.</p>
        <hr class="divider"/>
        <p>Best regards,<br/><strong>ATM Support Team</strong></p>
    `;

    await sendEmail(
        employee.email,
        `[Route Assignment] ${route.atmLocation} — ${new Date(route.scheduledDate).toDateString()}`,
        buildHtml("Route Verification", body)
    );
}

// ─── 3. Ticket Verification ───────────────────────────────────────────────────
// Call after a ticket is created to confirm it was logged successfully.

export async function sendTicketVerification(
    ticket: Ticket,
    recipientEmail: string,
    recipientName?: string
): Promise<void> {
    const name = recipientName ?? "Team Member";
    const ticketRef = ticket.ticket_no ?? ticket.id ?? "N/A";
    const status = (ticket.status ?? "open").toLowerCase().replace(" ", "_");

    const body = `
        <p>Dear <strong>${name}</strong>,</p>
        <p>This confirms that the following ticket has been successfully logged and is now active in the system.</p>
        <div class="info-box">
            <table>
                <tr><td>Ticket No.</td><td><span class="highlight">${ticketRef}</span></td></tr>
                <tr><td>Title</td><td>${ticket.title}</td></tr>
                <tr><td>Description</td><td>${ticket.description}</td></tr>
                <tr><td>Issue Type</td><td>${ticket.issue_type}</td></tr>
                <tr><td>Priority</td><td>${ticket.priority ?? "Normal"}</td></tr>
                <tr><td>Status</td><td><span class="badge badge-${status}">${ticket.status ?? "open"}</span></td></tr>
                <tr><td>ATM ID</td><td>${ticket.atm_id}</td></tr>
                <tr><td>ATM Location</td><td>${ticket.atm_location}</td></tr>
                <tr><td>Bank Location</td><td>${ticket.bank_location ?? "—"}</td></tr>
                <tr><td>Created At</td><td>${ticket.created_at ? new Date(ticket.created_at).toLocaleString() : "—"}</td></tr>
                ${ticket.assigned_to ? `<tr><td>Assigned To</td><td>${ticket.assigned_to}</td></tr>` : ""}
            </table>
        </div>
        <p>You will receive updates as the ticket progresses. Log in to your dashboard to track its status.</p>
        <hr class="divider"/>
        <p>Best regards,<br/><strong>ATM Support Team</strong></p>
    `;

    await sendEmail(
        recipientEmail,
        `[Ticket Confirmed] #${ticketRef} — ${ticket.title}`,
        buildHtml("Ticket Verification", body)
    );
}

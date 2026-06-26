import { Resend } from 'resend';
import { createAdminClient } from './supabase/admin';

// Initialize Resend. Falls back to a mock key to avoid crashing if env is missing.
const resend = new Resend(process.env.RESEND_API_KEY || 'mock-api-key');

export type EventType = 'ticket_assigned' | 'ticket_created' | 'ticket_closed' | 'ticket_in_progress' | 'ticket_re_raised';
export type RecipientType = 'employee' | 'admin' | 'open_pool' | 'bank_authority';

export async function sendNotification(
  event: EventType,
  ticketId: string,
  recipientType: RecipientType
) {
  try {
    const supabase = createAdminClient();

    // 1. Check if notification is enabled in config
    const { data: config } = await supabase
      .from('notification_config')
      .select('enabled')
      .eq('event_type', event)
      .eq('recipient_type', recipientType)
      .maybeSingle();

    if (config && !config.enabled) {
      console.log(`Notification disabled for ${event} to ${recipientType}`);
      return;
    }

    // 2. Fetch ticket details
    const { data: ticket } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (!ticket) return;

    // 3. Determine recipients
    let recipients: { email: string; firebase_uid: string }[] = [];
    
    if (recipientType === 'employee' && ticket.assigned_to) {
        const { data: emp } = await supabase.from('users').select('email, firebase_uid').eq('firebase_uid', ticket.assigned_to).single();
        if (emp) recipients.push(emp);
    } else if (recipientType === 'admin') {
        const { data: admins } = await supabase.from('admins').select('firebase_uid');
        if (admins?.length) {
            const adminUids = admins.map((a: any) => a.firebase_uid);
            const { data: adminUsers } = await supabase.from('users').select('email, firebase_uid').in('firebase_uid', adminUids);
            if (adminUsers) recipients = adminUsers;
        }
    } else if (recipientType === 'open_pool') {
        const { data: employees } = await supabase.from('employees').select('firebase_uid');
        if (employees?.length) {
            const employeeUids = employees.map((e: any) => e.firebase_uid);
            const { data: employeeUsers } = await supabase.from('users').select('email, firebase_uid').in('firebase_uid', employeeUids);
            if (employeeUsers) recipients = employeeUsers;
        }
    }

    if (recipients.length === 0) return;

    // We're passing basic HTML for the MVP to avoid react-email build issues on the edge
    for (const recipient of recipients) {
      try {
        let subject = `Update on Ticket ${ticket.ticket_no}`;
        let htmlBody = `<h1>Update on Ticket ${ticket.ticket_no}</h1>`;

        if (event === 'ticket_assigned') {
            subject = `New Ticket Assigned: ATM ${ticket.atm_id} - ${ticket.issue_type}`;
            htmlBody = `<h2>Ticket Assigned: ${ticket.ticket_no}</h2>
                        <p><strong>Title:</strong> ${ticket.title}</p>
                        <p><strong>Location:</strong> ${ticket.atm_location}</p>
                        <p><strong>Priority:</strong> ${ticket.issue_type}</p>
                        <p>Please log in to the CRM to view full details.</p>`;
        } else if (event === 'ticket_created') {
            subject = `New Open Ticket: ATM ${ticket.atm_id}`;
            htmlBody = `<h2>New Open Ticket in the Pool: ${ticket.ticket_no}</h2>
                        <p><strong>Title:</strong> ${ticket.title}</p>
                        <p><strong>Location:</strong> ${ticket.atm_location}</p>
                        <p>Log in to claim this ticket.</p>`;
        }

        const data = await resend.emails.send({
          from: 'KTech CRM <kevalmistry5927@gmail.com>',
          to: recipient.email,
          subject: subject,
          html: htmlBody,
        });

        // 5. Log success
        await supabase.from('notification_logs').insert([{
            event_type: event,
            ticket_id: ticket.id,
            recipient_email: recipient.email,
            recipient_id: recipient.firebase_uid,
            status: 'sent',
            error_message: null
        }]);

      } catch (err: any) {
        console.error(`Failed to send email to ${recipient.email}:`, err);
        // Log failure
        await supabase.from('notification_logs').insert([{
            event_type: event,
            ticket_id: ticket.id,
            recipient_email: recipient.email,
            recipient_id: recipient.firebase_uid,
            status: 'failed',
            error_message: err.message || 'Unknown error'
        }]);
      }
    }
  } catch (error) {
    console.error("Error in sendNotification pipeline:", error);
  }
}

import { Resend } from 'resend';
import { createAdminClient } from './supabase/admin';

const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

function maskSecret(value: string | undefined) {
  if (!value) return '<missing>';
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 5)}***${value.slice(-4)}`;
}

function getSenderDomain(from: string | undefined) {
  if (!from) return '<missing>';
  const match = from.match(/@([^>\s]+)>?$/);
  return match?.[1] ?? '<unknown>';
}

const resendApiKey = process.env.RESEND_API_KEY;
const resend = new Resend(resendApiKey);

export type EventType = 'ticket_assigned' | 'ticket_created' | 'ticket_closed' | 'ticket_in_progress' | 'ticket_re_raised';
export type RecipientType = 'employee' | 'admin' | 'open_pool' | 'bank_authority';

export async function sendNotification(
  event: EventType,
  ticketId: string,
  recipientType: RecipientType
) {
  console.log('send email called', {
    event,
    ticketId,
    recipientType,
    resendApiKey: maskSecret(process.env.RESEND_API_KEY),
    from: RESEND_FROM_EMAIL,
    senderDomain: getSenderDomain(RESEND_FROM_EMAIL),
  });

  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is missing at runtime.');
    }

    if (!RESEND_FROM_EMAIL) {
      throw new Error('RESEND_FROM_EMAIL is missing. Set it to an address on a domain verified in Resend, for example no-reply@yourdomain.com.');
    }

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

    if (!ticket) {
      console.warn('Notification skipped because ticket was not found', { ticketId });
      return;
    }

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

    if (recipients.length === 0) {
      console.warn('Notification skipped because no recipients were found', {
        event,
        ticketId,
        recipientType,
      });
      return;
    }

    const failures: string[] = [];

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

        const { data, error } = await resend.emails.send({
          from: RESEND_FROM_EMAIL,
          to: recipient.email,
          subject: subject,
          html: htmlBody,
        });

        console.log('Resend email response', {
          recipient: recipient.email,
          data,
          error,
        });

        if (error) {
          throw new Error(
            `Resend failed: ${error.name || 'Unknown'} - ${error.message || JSON.stringify(error)}`
          );
        }

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
        const message = err.message || 'Unknown error';
        failures.push(`${recipient.email}: ${message}`);
        console.error(`Failed to send email to ${recipient.email}:`, err);
        // Log failure
        await supabase.from('notification_logs').insert([{
            event_type: event,
            ticket_id: ticket.id,
            recipient_email: recipient.email,
            recipient_id: recipient.firebase_uid,
            status: 'failed',
            error_message: message
        }]);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Email notification failed for ${failures.length} recipient(s): ${failures.join('; ')}`);
    }
  } catch (error) {
    console.error("Error in sendNotification pipeline:", error);
    throw error;
  }
}

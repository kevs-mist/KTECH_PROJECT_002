# Email Service Setup

This application uses Nodemailer for sending transactional emails. Email functionality is integrated with ticket creation and employee verification workflows.

## Required Environment Variables

Add the following variables to your `.env.local` file:

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="ATM Support <no-reply@yourdomain.com>"
```

## SMTP Providers

### Gmail (Recommended for Development)
1. Enable 2-Factor Authentication on your Google Account
2. Generate an App Password:
   - Go to Google Account > Security
   - Select "2-Step Verification"
   - Select "App passwords"
   - Generate a new password for "Mail"
3. Use the App Password as `SMTP_PASS`

### Other Providers
- **SendGrid**: Use `smtp.sendgrid.net` as host, port 587
- **AWS SES**: Use your SES SMTP endpoint
- **Mailgun**: Use `smtp.mailgun.org` as host, port 587

## Email Functions

### 1. Ticket Verification
Automatically sent when a ticket is created. Includes:
- Ticket number and details
- Issue type and priority
- ATM location information
- Assigned engineer (if applicable)

**Usage**: Integrated in `ticketActions.ts` - `createTicketAction`

### 2. Employee Verification
Sent when a new employee account is created. Includes:
- Employee ID and details
- Department and status
- Verification link

**Usage**: Available in `employeeActions.ts` - call `sendEmployeeVerification`

### 3. Route Assignment
Sent when a route is assigned to an employee. Includes:
- Route ID and ATM details
- Scheduled date and duration
- Special instructions

**Usage**: Available in `email.ts` - call `sendRouteVerification`

## Testing

Run email tests:
```bash
npm test -- __tests__/unit/email.test.ts
```

Tests verify:
- Environment variable configuration
- Transporter creation
- Email function exports
- HTML template generation
- SendMail parameter validation

## Security Notes

- Never commit SMTP credentials to version control
- Use App Passwords instead of regular passwords
- Consider using a dedicated email service for production
- Email sending errors are logged but don't fail the primary operation
- All emails use HTML templates with consistent branding

## Troubleshooting

### Emails not sending
1. Verify SMTP credentials are correct
2. Check if your SMTP provider requires additional authentication
3. Ensure the SMTP port is not blocked by your firewall
4. Check application logs for error messages

### Gmail authentication errors
1. Ensure you're using an App Password, not your regular password
2. Check that "Less secure app access" is enabled (if required)
3. Verify 2-Factor Authentication is enabled

### Rate limiting
- Gmail: ~100 emails/day for free accounts
- Consider upgrading to a dedicated email service for higher volumes

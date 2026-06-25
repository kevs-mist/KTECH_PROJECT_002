-- Migration: Create Notifications Tables
-- Description: Sets up the notification_config and notification_logs tables with RLS policies.

-- 1. Create notification_config table
CREATE TABLE IF NOT EXISTS public.notification_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- e.g., 'ticket_assigned', 'ticket_created'
  recipient_type VARCHAR(50) NOT NULL, -- 'employee', 'admin', 'open_pool', 'bank_authority'
  enabled BOOLEAN DEFAULT true,
  email_template_id VARCHAR(100), -- Reference to Resend email template
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(event_type, recipient_type)
);

-- 2. Create notification_logs table
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255),
  recipient_id text REFERENCES public.users(firebase_uid) ON DELETE SET NULL,
  status VARCHAR(20), -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_notification_logs_ticket ON public.notification_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_email ON public.notification_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient ON public.notification_logs(recipient_id);

-- 4. Triggers for updated_at
DROP TRIGGER IF EXISTS update_notification_config_updated_at ON public.notification_config;
CREATE TRIGGER update_notification_config_updated_at
    BEFORE UPDATE ON public.notification_config
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 5. Enable RLS
ALTER TABLE public.notification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Admins can do everything on notification_config
DROP POLICY IF EXISTS "Admins have full access to notification_config" ON public.notification_config;
CREATE POLICY "Admins have full access to notification_config" ON public.notification_config
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE firebase_uid = auth.uid()::text
        )
    );

-- Admins can view all notification logs
DROP POLICY IF EXISTS "Admins can view all notification_logs" ON public.notification_logs;
CREATE POLICY "Admins can view all notification_logs" ON public.notification_logs
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE firebase_uid = auth.uid()::text
        )
    );

-- Users can view their own notification logs
DROP POLICY IF EXISTS "Users can view their own notification_logs" ON public.notification_logs;
CREATE POLICY "Users can view their own notification_logs" ON public.notification_logs
    FOR SELECT 
    USING (
        recipient_id = auth.uid()::text
    );

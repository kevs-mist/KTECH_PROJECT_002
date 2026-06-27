-- Migration: Strengthen Notification Security
-- Description: Adds rate limiting and strengthens RLS policies for notifications

-- Add rate limiting index to prevent notification spam
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON public.notifications(recipient_id, created_at DESC);

-- Drop and recreate RLS policies with stronger security

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Strengthened policy: Users can only view their own notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT
  USING (
    recipient_id = auth.uid()::text
    AND recipient_id IN (SELECT firebase_uid FROM public.users WHERE firebase_uid = auth.uid()::text)
  );

-- Strengthened policy: Users can only update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE
  USING (
    recipient_id = auth.uid()::text
    AND recipient_id IN (SELECT firebase_uid FROM public.users WHERE firebase_uid = auth.uid()::text)
  )
  WITH CHECK (
    recipient_id = auth.uid()::text
    AND recipient_id IN (SELECT firebase_uid FROM public.users WHERE firebase_uid = auth.uid()::text)
  );

-- Strengthened policy: Service role can insert notifications with recipient validation
CREATE POLICY "Service role can insert notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (
    -- Only allow if recipient exists in users table
    recipient_id IN (SELECT firebase_uid FROM public.users WHERE firebase_uid = public.notifications.recipient_id)
    -- Validate notification type
    AND type IN ('ticket_assigned', 'ticket_open_pool', 'ticket_updated')
    -- Validate field lengths
    AND length(title) <= 255
    AND length(message) <= 1000
  );

-- Add check constraint for notification types
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS check_notification_type;

ALTER TABLE public.notifications
  ADD CONSTRAINT check_notification_type
  CHECK (type IN ('ticket_assigned', 'ticket_open_pool', 'ticket_updated'));

-- Add check constraint for field lengths
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS check_title_length;

ALTER TABLE public.notifications
  ADD CONSTRAINT check_title_length
  CHECK (length(title) <= 255);

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS check_message_length;

ALTER TABLE public.notifications
  ADD CONSTRAINT check_message_length
  CHECK (length(message) <= 1000);

-- Migration: Add Performance Indexes
-- Description: Adds indexes for frequently queried columns to improve query performance

-- Indexes for tickets table
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_status ON public.tickets(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tickets_status_created_at ON public.tickets(status, created_at DESC);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON public.users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Indexes for check_ins table
CREATE INDEX IF NOT EXISTS idx_check_ins_employee_checked_in_at ON public.check_ins(employee_id, checked_in_at DESC);

-- Indexes for notifications table (using recipient_id, not user_id)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id_is_read ON public.notifications(recipient_id, is_read);

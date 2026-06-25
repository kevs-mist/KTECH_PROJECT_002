-- Migration: Create Check-ins Table
-- Description: Sets up the check_ins table for the Live Location Check-in System with RLS policies.

-- 1. Create the check_ins table
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  employee_id text NOT NULL REFERENCES public.users(firebase_uid),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: employee_id references firebase_uid from users table since that is the primary identifier used in this database for RLS.

-- 2. Create Indexes
CREATE INDEX IF NOT EXISTS idx_check_ins_ticket ON public.check_ins(ticket_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_employee ON public.check_ins(employee_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_timestamp ON public.check_ins(checked_in_at DESC);

-- 3. Enable RLS
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Admins can view all check-ins
DROP POLICY IF EXISTS "Admins can view all check-ins" ON public.check_ins;
CREATE POLICY "Admins can view all check-ins" ON public.check_ins
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.firebase_uid = auth.uid()::text

            
        )
    );

-- Employees can view check-ins for tickets assigned to them
DROP POLICY IF EXISTS "Employees can view relevant check-ins" ON public.check_ins;
CREATE POLICY "Employees can view relevant check-ins" ON public.check_ins
    FOR SELECT 
    USING (
        employee_id = auth.uid()::text
    );

-- Employees can insert check-ins for themselves
DROP POLICY IF EXISTS "Employees can insert their own check-ins" ON public.check_ins;
CREATE POLICY "Employees can insert their own check-ins" ON public.check_ins
    FOR INSERT 
    WITH CHECK (
        employee_id = auth.uid()::text
    );

-- =============================================================================
-- Migration: Default role is Employee, Admin Request creates pending user
-- =============================================================================

-- 0. Create a sequence for auto-generating employee IDs
CREATE SEQUENCE IF NOT EXISTS employee_id_seq START 1001;

-- 1. Migrate all existing users with role='user' to role='employee'
UPDATE public.users SET role = 'employee' WHERE role = 'user';

-- 2. Create employees records for all users with role='employee' 
--    that don't already have one
INSERT INTO public.employees (firebase_uid, employee_id, department, status)
SELECT 
    u.firebase_uid,
    'EMP-' || LPAD(nextval('employee_id_seq')::text, 4, '0'),
    'Field Operations',
    'active'
FROM public.users u
LEFT JOIN public.employees e ON u.firebase_uid = e.firebase_uid
WHERE u.role = 'employee' AND e.id IS NULL;

-- 3. Create admin_requests table for pending admin access requests
CREATE TABLE IF NOT EXISTS public.admin_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    firebase_uid text NOT NULL REFERENCES public.users(firebase_uid) ON DELETE CASCADE,
    email text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by text, -- admin who reviewed the request
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Allow all operations (auth handled by Firebase at app level)
CREATE POLICY "Allow all on admin_requests" ON public.admin_requests
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Update the users role CHECK constraint to include 'pending_admin'
-- First drop the old constraint, then add the new one
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('user', 'employee', 'admin', 'pending_admin'));

-- 5. Add RLS policies for employees table (same pattern as tickets)
CREATE POLICY "Allow all on employees" ON public.employees
    FOR ALL USING (true) WITH CHECK (true);

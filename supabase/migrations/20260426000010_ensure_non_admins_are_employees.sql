-- Migration: Ensure all non-admin users are employees
-- Description: Inserts any user with role != 'admin' into the employees table if they don't already exist.
-- This ensures data integrity: every user that isn't an admin is treated as an employee.

-- Insert all non-admin users who don't have an employee record
INSERT INTO public.employees (firebase_uid, employee_id, status, joined_at)
SELECT 
    u.firebase_uid,
    'EMP-' || SUBSTRING(u.firebase_uid, 1, 8) || '-' || TO_CHAR(NOW(), 'YYYYMMDD'),
    'active',
    COALESCE(u.created_at, NOW())
FROM public.users u
WHERE u.role != 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.employees e 
    WHERE e.firebase_uid = u.firebase_uid
  )
ON CONFLICT (firebase_uid) DO NOTHING;

-- Optionally: update users table to ensure non-admin users have role set to 'employee'
-- (in case any have NULL or invalid role values)
UPDATE public.users
SET role = 'employee'
WHERE role IS NULL OR role = 'user';

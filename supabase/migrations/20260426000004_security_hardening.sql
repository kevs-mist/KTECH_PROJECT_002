-- =============================================================================
-- SECURITY HARDENING: Lockdown RLS
-- =============================================================================
-- This migration revokes the dangerous 'public' access created earlier.
-- Authentication and authorization are now handled by Secure Server Actions.
-- Direct database access from the client is restricted.
-- =============================================================================

-- 1. Tighten Users table
DROP POLICY IF EXISTS "Allow public select on users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert on users" ON public.users;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Tighten Admins table (MOST CRITICAL)
DROP POLICY IF EXISTS "Allow public select on admins" ON public.admins;
DROP POLICY IF EXISTS "Allow public insert on admins" ON public.admins;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- 3. Tighten Employees table
DROP POLICY IF EXISTS "Allow public select on employees" ON public.employees;
DROP POLICY IF EXISTS "Allow public insert on employees" ON public.employees;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 4. Tighten Tickets table
DROP POLICY IF EXISTS "Allow read access to tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow delete tickets" ON public.tickets;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- 5. Tighten Admin Requests
DROP POLICY IF EXISTS "Allow public insert on admin_requests" ON public.admin_requests;
DROP POLICY IF EXISTS "Allow public select on admin_requests" ON public.admin_requests;
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Optional: Allow minimal read-only access for authenticated users IF needed.
-- Since we use Server Actions for almost everything now, we can keep these 
-- tables completely locked to the anonymous role.
-- =============================================================================

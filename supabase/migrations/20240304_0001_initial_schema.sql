-- Initial Database Schema for KTech Field CRM
-- This migration sets up the core tables required for role-based authentication and user profiles.

-- 1. Profiles/Users Table (Base)
CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    firebase_uid text UNIQUE NOT NULL,
    email text UNIQUE NOT NULL,
    full_name text,
    role text DEFAULT 'user' CHECK (role IN ('user', 'employee', 'admin')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Employees Table (Staff)
CREATE TABLE IF NOT EXISTS public.employees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    firebase_uid text UNIQUE NOT NULL REFERENCES public.users(firebase_uid) ON DELETE CASCADE,
    employee_id text UNIQUE NOT NULL, -- e.g., EMP-1001
    department text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'terminated')),
    joined_at timestamptz DEFAULT now()
);

-- 3. Admins Table (Highly Privileged)
CREATE TABLE IF NOT EXISTS public.admins (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    firebase_uid text UNIQUE NOT NULL REFERENCES public.users(firebase_uid) ON DELETE CASCADE,
    secret_code text NOT NULL, -- Specifically for the two-phase authentication
    is_super_admin boolean DEFAULT false,
    last_access timestamptz
);

-- 4. Audit Logs (Security Tracking)
CREATE TABLE IF NOT EXISTS public.login_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL,
    login_time timestamptz DEFAULT now(),
    ip_address text,
    user_agent text
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Basic examples for start)
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid()::text = firebase_uid);

CREATE POLICY "Enable inserts for new users" ON public.users
    FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON public.users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_employees_firebase_uid ON public.employees(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_admins_firebase_uid ON public.admins(firebase_uid);

-- Enable inserts for new users during registration
CREATE POLICY "Enable inserts for new users" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable inserts for new users" ON public.users
    FOR INSERT WITH CHECK (true);

-- 1. Fix the Users table (Allows Firebase users to be created and read)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Allow public select on users" ON public.users;
CREATE POLICY "Allow public select on users" ON public.users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on users" ON public.users;
CREATE POLICY "Allow public insert on users" ON public.users FOR INSERT WITH CHECK (true);

-- 2. Fix the Admins table (Allows the login system to check if user is an admin)
DROP POLICY IF EXISTS "Allow public select on admins" ON public.admins;
CREATE POLICY "Allow public select on admins" ON public.admins FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on admins" ON public.admins;
CREATE POLICY "Allow public insert on admins" ON public.admins FOR INSERT WITH CHECK (true);

-- 3. Fix the Employees table (Allows the login system to check if user is an employee)
DROP POLICY IF EXISTS "Allow public select on employees" ON public.employees;
CREATE POLICY "Allow public select on employees" ON public.employees FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on employees" ON public.employees;
CREATE POLICY "Allow public insert on employees" ON public.employees FOR INSERT WITH CHECK (true);

-- 4. Create admin_requests table for tracking requested admins
CREATE TABLE IF NOT EXISTS public.admin_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    firebase_uid text UNIQUE NOT NULL REFERENCES public.users(firebase_uid) ON DELETE CASCADE,
    email text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert on admin_requests" ON public.admin_requests;
CREATE POLICY "Allow public insert on admin_requests" ON public.admin_requests FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public select on admin_requests" ON public.admin_requests;
CREATE POLICY "Allow public select on admin_requests" ON public.admin_requests FOR SELECT USING (true);

-- Allow Firebase users to be added to the admins table
DROP POLICY IF EXISTS "Allow public select on admins" ON public.admins;
CREATE POLICY "Allow public select on admins" ON public.admins FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on admins" ON public.admins;
CREATE POLICY "Allow public insert on admins" ON public.admins FOR INSERT WITH CHECK (true);

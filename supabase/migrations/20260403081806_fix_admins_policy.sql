DROP POLICY IF EXISTS "Allow public select on admins" ON public.admins;
CREATE POLICY "Allow public select on admins" ON public.admins FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on admins" ON public.admins;
CREATE POLICY "Allow public insert on admins" ON public.admins FOR INSERT WITH CHECK (true);

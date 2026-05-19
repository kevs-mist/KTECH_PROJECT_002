CREATE POLICY "Allow public select on admins" ON public.admins FOR SELECT USING (true);
CREATE POLICY "Allow public insert on admins" ON public.admins FOR INSERT WITH CHECK (true);

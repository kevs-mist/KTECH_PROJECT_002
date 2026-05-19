-- Temporary: Relax RLS for Ticket Creation
CREATE POLICY "Anyone can create tickets" ON public.tickets
    FOR INSERT 
    WITH CHECK (true);

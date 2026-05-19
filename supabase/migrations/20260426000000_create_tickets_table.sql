-- Migration: Create Tickets Table
-- Description: Sets up the core ticket management system with sequential ticket numbers and RLS policies.

-- 1. Create a sequence for the ticket numbers starting at 1001
CREATE SEQUENCE IF NOT EXISTS ticket_no_seq START 1001;

-- 2. Create the Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_no text UNIQUE DEFAULT ('TKT-' || nextval('ticket_no_seq')::text),
    title text NOT NULL,
    description text NOT NULL,
    issue_type text NOT NULL, -- e.g., 'Hardware', 'Software', 'Network'
    status text DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'pending', 'closed', 're_raised')),
    atm_id text NOT NULL,
    bank_id text NOT NULL,
    atm_location text NOT NULL, -- Google Maps link or Lat/Lng
    bank_location text,
    assigned_to text REFERENCES public.users(firebase_uid) ON DELETE SET NULL,
    created_by text NOT NULL REFERENCES public.users(firebase_uid),
    proof_media_url text, -- Photo/Video path in Storage
    resolution_notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Admins can do everything
CREATE POLICY "Admins have full access to tickets" ON public.tickets
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE firebase_uid = auth.uid()::text
        )
    );

-- TEMPORARY: Allow all users to create tickets during development
CREATE POLICY "Anyone can create tickets" ON public.tickets
    FOR INSERT 
    WITH CHECK (true);

-- Employees can see unassigned open tickets OR tickets assigned to them
CREATE POLICY "Employees can view relevant tickets" ON public.tickets
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE firebase_uid = auth.uid()::text
        ) AND (
            status = 'open' OR assigned_to = auth.uid()::text
        )
    );

-- Employees can update tickets assigned to them (to change status or add proof)
CREATE POLICY "Employees can update assigned tickets" ON public.tickets
    FOR UPDATE
    USING (
        assigned_to = auth.uid()::text
    );

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_atm_id ON public.tickets(atm_id);

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON public.tickets
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

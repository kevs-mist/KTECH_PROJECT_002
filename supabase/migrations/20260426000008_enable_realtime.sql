-- Migration: Enable Supabase Realtime
-- Description: Configures the tickets and employees tables to be part of the supabase_realtime publication.

-- Ensure the publication exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Add tables to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;

-- Set replica identity to FULL for tickets to ensure we get all data in the payload if needed
-- (Default is usually enough for IDs, but FULL is safer for complex dashboards)
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER TABLE public.employees REPLICA IDENTITY FULL;

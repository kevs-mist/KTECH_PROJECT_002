-- Migration: Add Optimistic Locking to Tickets
-- Description: Adds a 'version' column to the tickets table and an auto-increment trigger to prevent race conditions during concurrent updates.

-- 1. Add version column
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- 2. Create trigger function to auto-increment version
CREATE OR REPLACE FUNCTION public.increment_ticket_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Always increment the version on update
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trg_increment_ticket_version ON public.tickets;
CREATE TRIGGER trg_increment_ticket_version
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.increment_ticket_version();

-- Migration: Add Online Status to Employees
-- Description: Adds is_online and last_seen columns to track engineer activity.

ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();

-- Create an index for performance when filtering by online status
CREATE INDEX IF NOT EXISTS idx_employees_is_online ON public.employees(is_online);

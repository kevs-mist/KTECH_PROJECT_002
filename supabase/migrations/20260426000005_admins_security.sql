-- Migration: Security Hardening Admins Table
-- Description: Adds brute-force protection and prepares for hashed secret codes.

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS failed_attempts int DEFAULT 0;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Note: In a real scenario, you'd run a script to hash existing codes.
-- For now, we just prepare the schema.

-- Migration: Add engineer fields to atm_locations
-- Description: Add missing engineer columns required by ATM import/list APIs.

ALTER TABLE public.atm_locations
  ADD COLUMN IF NOT EXISTS engineer_name TEXT,
  ADD COLUMN IF NOT EXISTS engineer_contact TEXT,
  ADD COLUMN IF NOT EXISTS engineer_email TEXT;

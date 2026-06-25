-- Migration: Add location column to atm_locations
-- Description: Ensure atm_locations supports a dedicated location field used by the ATM import and list APIs.

ALTER TABLE public.atm_locations
  ADD COLUMN IF NOT EXISTS location TEXT;

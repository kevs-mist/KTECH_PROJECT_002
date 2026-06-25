-- Migration: Create ATM Locations Table
-- Description: Master table for ATM locations, indexes, triggers, and RLS policies.

-- 1. Create atm_locations table
CREATE TABLE IF NOT EXISTS public.atm_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atm_id VARCHAR(100) UNIQUE NOT NULL,
  bank_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postcode VARCHAR(50),
  country VARCHAR(100),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_atm_locations_atm_id ON public.atm_locations(atm_id);
CREATE INDEX IF NOT EXISTS idx_atm_locations_latlong ON public.atm_locations(latitude, longitude);

-- 3. Add atm_location_id to tickets table (nullable)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS atm_location_id UUID REFERENCES public.atm_locations(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS update_atm_locations_updated_at ON public.atm_locations;
CREATE TRIGGER update_atm_locations_updated_at
    BEFORE UPDATE ON public.atm_locations
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 5. Enable RLS
ALTER TABLE public.atm_locations ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Admins have full access
DROP POLICY IF EXISTS "Admins have full access to atm_locations" ON public.atm_locations;
CREATE POLICY "Admins have full access to atm_locations" ON public.atm_locations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.admins WHERE admins.firebase_uid = auth.uid()::text
        )
    );

-- Authenticated users can SELECT ATM list (for dropdown/autocomplete)
DROP POLICY IF EXISTS "Authenticated users can select atm_locations" ON public.atm_locations;
CREATE POLICY "Authenticated users can select atm_locations" ON public.atm_locations
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
    );

-- Only admins may INSERT or UPDATE
DROP POLICY IF EXISTS "Admins may insert atm_locations" ON public.atm_locations;
CREATE POLICY "Admins may insert atm_locations" ON public.atm_locations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins WHERE admins.firebase_uid = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Admins may update atm_locations" ON public.atm_locations;
CREATE POLICY "Admins may update atm_locations" ON public.atm_locations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admins WHERE admins.firebase_uid = auth.uid()::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins WHERE admins.firebase_uid = auth.uid()::text
        )
    );

-- 7. Sample insert (commented out) — replace or remove as needed.
-- INSERT INTO public.atm_locations (atm_id, bank_name, address, city, state, postcode, country, latitude, longitude)
-- VALUES ('ATM-0001', 'Acme Bank', '123 Main St', 'Metropolis', 'State', '12345', 'Country', 12.345678, 98.765432);

-- Grand$tate License Key System Schema
-- Run this in Supabase SQL Editor

-- =============================================
-- LICENSE KEYS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.license_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  package TEXT NOT NULL CHECK (package IN ('free', 'agent', 'elite')),
  max_devices INTEGER NOT NULL DEFAULT 1,  -- 1 license = 1 device always
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  owner_name TEXT,
  owner_contact TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DEVICE ACTIVATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.device_activations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  license_key_id UUID REFERENCES public.license_keys(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(license_key_id, device_id)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON public.license_keys(license_key);
CREATE INDEX IF NOT EXISTS idx_license_keys_active ON public.license_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_device_activations_license ON public.device_activations(license_key_id);
CREATE INDEX IF NOT EXISTS idx_device_activations_device ON public.device_activations(device_id);

-- =============================================
-- RLS POLICIES (Allow anonymous read for validation)
-- =============================================
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_activations ENABLE ROW LEVEL SECURITY;

-- Allow public read for license validation
CREATE POLICY "Allow public license validation" ON public.license_keys
  FOR SELECT USING (true);

-- Allow public read/insert/update for device activations
CREATE POLICY "Allow public device read" ON public.device_activations
  FOR SELECT USING (true);

CREATE POLICY "Allow public device insert" ON public.device_activations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public device update" ON public.device_activations
  FOR UPDATE USING (true);

-- =============================================
-- HELPER: Generate License Key
-- Usage: SELECT generate_license_key();
-- =============================================
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'GSTATE-';
  i INTEGER;
  j INTEGER;
BEGIN
  FOR j IN 1..3 LOOP
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF j < 3 THEN
      result := result || '-';
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- EXAMPLE: Create test license keys
-- =============================================
-- Free package (1 device, 7 days trial)
-- INSERT INTO license_keys (license_key, package, max_devices, expires_at, note)
-- VALUES (generate_license_key(), 'free', 1, NOW() + INTERVAL '7 days', 'Free trial');

-- Agent package (3 devices, 30 days)
-- INSERT INTO license_keys (license_key, package, max_devices, expires_at, owner_name, note)
-- VALUES (generate_license_key(), 'agent', 3, NOW() + INTERVAL '30 days', 'Customer Name', 'Agent monthly');

-- Elite package (5 devices, 30 days)
-- INSERT INTO license_keys (license_key, package, max_devices, expires_at, owner_name, note)
-- VALUES (generate_license_key(), 'elite', 5, NOW() + INTERVAL '30 days', 'VIP Customer', 'Elite monthly');

-- View all keys:
-- SELECT license_key, package, max_devices, expires_at, is_active FROM license_keys;

-- ══════════════════════════════════════════════════════════════
--  Grand$tate — FULL Database Setup (Safe to re-run)
--  รันใน Supabase Dashboard → SQL Editor
--  ทุก statement ใช้ IF NOT EXISTS / CREATE OR REPLACE
--  → รันซ้ำกี่ครั้งก็ไม่พัง
-- ══════════════════════════════════════════════════════════════


-- ═══════════════════════════
--  PART 1: EXTENSIONS
-- ═══════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ═══════════════════════════
--  PART 2: TABLES
-- ═══════════════════════════

-- 2.1 Users (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  proxy_url TEXT,
  package TEXT DEFAULT 'free' CHECK (package IN ('free', 'starter', 'top_agent', 'elite')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Properties
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  property_type TEXT NOT NULL,
  price NUMERIC NOT NULL,
  area_size NUMERIC,
  bedrooms INTEGER,
  bathrooms INTEGER,
  location TEXT NOT NULL,
  province TEXT,
  district TEXT,
  description TEXT,
  features TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold', 'rented')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Facebook Groups
CREATE TABLE IF NOT EXISTS public.facebook_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  group_id TEXT NOT NULL,
  member_count INTEGER DEFAULT 0,
  posts_today INTEGER DEFAULT 0,
  posts_last_month INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_posted TIMESTAMPTZ,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

-- 2.4 License Keys
CREATE TABLE IF NOT EXISTS public.license_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  package TEXT NOT NULL CHECK (package IN ('free', 'agent', 'elite')),
  max_devices INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  owner_name TEXT,
  owner_contact TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Device Activations
CREATE TABLE IF NOT EXISTS public.device_activations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  license_key_id UUID REFERENCES public.license_keys(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(license_key_id, device_id)
);

-- 2.6 Add bound_user_id to license_keys (ผูก license กับ user)
ALTER TABLE public.license_keys
  ADD COLUMN IF NOT EXISTS bound_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;


-- ═══════════════════════════
--  PART 3: INDEXES
-- ═══════════════════════════

CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_facebook_groups_user_id ON public.facebook_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_facebook_groups_is_active ON public.facebook_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON public.license_keys(license_key);
CREATE INDEX IF NOT EXISTS idx_license_keys_active ON public.license_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_license_keys_bound_user_id ON public.license_keys(bound_user_id);
CREATE INDEX IF NOT EXISTS idx_device_activations_license ON public.device_activations(license_key_id);
CREATE INDEX IF NOT EXISTS idx_device_activations_device ON public.device_activations(device_id);


-- ═══════════════════════════
--  PART 4: FUNCTIONS
-- ═══════════════════════════

-- 4.1 Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- 4.2 Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4.3 Generate license key helper
CREATE OR REPLACE FUNCTION public.generate_license_key()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;

-- 4.4 Admin check function (CRITICAL: ใช้ .com ไม่ใช่ .co)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  ) IN (
    'admin@grandstate.com'
    -- เพิ่ม admin email ได้ที่นี่:
    -- , 'another-admin@email.com'
  );
END;
$$;


-- ═══════════════════════════
--  PART 5: TRIGGERS
-- ═══════════════════════════

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_properties_updated_at ON public.properties;
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ═══════════════════════════
--  PART 6: ENABLE RLS
-- ═══════════════════════════

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_activations ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════
--  PART 7: RLS POLICIES
-- ═══════════════════════════

-- ── 7.1 USERS ──
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- ── 7.2 PROPERTIES ──
DROP POLICY IF EXISTS "Users can view own properties" ON public.properties;
CREATE POLICY "Users can view own properties" ON public.properties
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own properties" ON public.properties;
CREATE POLICY "Users can insert own properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own properties" ON public.properties;
CREATE POLICY "Users can update own properties" ON public.properties
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own properties" ON public.properties;
CREATE POLICY "Users can delete own properties" ON public.properties
  FOR DELETE USING (auth.uid() = user_id);

-- ── 7.3 FACEBOOK GROUPS ──
DROP POLICY IF EXISTS "Users can view own groups" ON public.facebook_groups;
CREATE POLICY "Users can view own groups" ON public.facebook_groups
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own groups" ON public.facebook_groups;
CREATE POLICY "Users can insert own groups" ON public.facebook_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own groups" ON public.facebook_groups;
CREATE POLICY "Users can update own groups" ON public.facebook_groups
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own groups" ON public.facebook_groups;
CREATE POLICY "Users can delete own groups" ON public.facebook_groups
  FOR DELETE USING (auth.uid() = user_id);

-- ── 7.4 LICENSE KEYS ──
DROP POLICY IF EXISTS "Anyone can read license keys" ON public.license_keys;
DROP POLICY IF EXISTS "Allow public license validation" ON public.license_keys;
CREATE POLICY "Anyone can read license keys" ON public.license_keys
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can bind license to own account" ON public.license_keys;
CREATE POLICY "Users can bind license to own account" ON public.license_keys
  FOR UPDATE
  USING (bound_user_id IS NULL OR bound_user_id = auth.uid())
  WITH CHECK (bound_user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can insert license keys" ON public.license_keys;
CREATE POLICY "Admin can insert license keys" ON public.license_keys
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can delete license keys" ON public.license_keys;
CREATE POLICY "Admin can delete license keys" ON public.license_keys
  FOR DELETE USING (is_admin());

-- ── 7.5 DEVICE ACTIVATIONS ──
DROP POLICY IF EXISTS "Anyone can read device activations" ON public.device_activations;
DROP POLICY IF EXISTS "Anyone can insert device activations" ON public.device_activations;
DROP POLICY IF EXISTS "Anyone can update device activations" ON public.device_activations;
DROP POLICY IF EXISTS "Allow public device read" ON public.device_activations;
DROP POLICY IF EXISTS "Allow public device insert" ON public.device_activations;
DROP POLICY IF EXISTS "Allow public device update" ON public.device_activations;
DROP POLICY IF EXISTS "Allow reading device activations with license" ON public.device_activations;
DROP POLICY IF EXISTS "Allow registering device activation" ON public.device_activations;
DROP POLICY IF EXISTS "Allow updating device activation" ON public.device_activations;

CREATE POLICY "Allow reading device activations with license" ON public.device_activations
  FOR SELECT USING (license_key_id IS NOT NULL);

CREATE POLICY "Allow registering device activation" ON public.device_activations
  FOR INSERT WITH CHECK (license_key_id IS NOT NULL);

CREATE POLICY "Allow updating device activation" ON public.device_activations
  FOR UPDATE USING (license_key_id IS NOT NULL);

DROP POLICY IF EXISTS "Admin can delete device activations" ON public.device_activations;
CREATE POLICY "Admin can delete device activations" ON public.device_activations
  FOR DELETE USING (is_admin());


-- ══════════════════════════════════════════════════════════════
--  ✅ DONE! ทุกอย่างพร้อมใช้งาน
--  ตรวจสอบได้ที่: Supabase Dashboard → Authentication → Policies
-- ══════════════════════════════════════════════════════════════

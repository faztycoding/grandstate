-- ══════════════════════════════════════════════════════════════
--  Grand$tate — RLS Verification & Fix Script
--  รันใน Supabase Dashboard → SQL Editor
--  วันที่: 2026-02-27
-- ══════════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────┐
-- │  STEP 1: ตรวจว่า RLS เปิดอยู่ทุกตาราง     │
-- └──────────────────────────────────────────┘

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'facebook_groups', 'license_keys', 'device_activations', 'users')
ORDER BY tablename;

-- ผลที่ถูกต้อง: rls_enabled = true ทุกแถว
-- ถ้า false ให้รัน ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;

-- ┌──────────────────────────────────────────┐
-- │  STEP 2: ตรวจ policy ที่มีอยู่             │
-- └──────────────────────────────────────────┘

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ┌──────────────────────────────────────────┐
-- │  STEP 3: แก้ is_admin() — email typo     │
-- │  .co → .com (CRITICAL FIX)              │
-- └──────────────────────────────────────────┘

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

-- ┌──────────────────────────────────────────┐
-- │  STEP 4: ยืนยัน RLS เปิดทุกตาราง         │
-- └──────────────────────────────────────────┘

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
--  เสร็จ! ตรวจผลได้ที่ Supabase Dashboard → Authentication → Policies
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
--  Grand$tate — Supabase RLS Policies
--  รันใน Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────┐
-- │  1. PROPERTIES TABLE                    │
-- │  user เห็น/แก้/ลบ เฉพาะข้อมูลตัวเอง      │
-- └─────────────────────────────────────────┘

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- ลบ policy เก่า (ถ้ามี) เพื่อป้องกัน error ซ้ำ
DROP POLICY IF EXISTS "Users can view own properties" ON properties;
DROP POLICY IF EXISTS "Users can insert own properties" ON properties;
DROP POLICY IF EXISTS "Users can update own properties" ON properties;
DROP POLICY IF EXISTS "Users can delete own properties" ON properties;

-- SELECT: user เห็นเฉพาะ properties ของตัวเอง
CREATE POLICY "Users can view own properties"
  ON properties FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: user สร้าง property ได้ โดย user_id ต้องตรงกับตัวเอง
CREATE POLICY "Users can insert own properties"
  ON properties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: user แก้ไขได้เฉพาะ properties ของตัวเอง
CREATE POLICY "Users can update own properties"
  ON properties FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: user ลบได้เฉพาะ properties ของตัวเอง
CREATE POLICY "Users can delete own properties"
  ON properties FOR DELETE
  USING (auth.uid() = user_id);


-- ┌─────────────────────────────────────────┐
-- │  2. FACEBOOK_GROUPS TABLE               │
-- │  user เห็น/แก้/ลบ เฉพาะกลุ่มของตัวเอง     │
-- └─────────────────────────────────────────┘

ALTER TABLE facebook_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own groups" ON facebook_groups;
DROP POLICY IF EXISTS "Users can insert own groups" ON facebook_groups;
DROP POLICY IF EXISTS "Users can update own groups" ON facebook_groups;
DROP POLICY IF EXISTS "Users can delete own groups" ON facebook_groups;

CREATE POLICY "Users can view own groups"
  ON facebook_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own groups"
  ON facebook_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own groups"
  ON facebook_groups FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own groups"
  ON facebook_groups FOR DELETE
  USING (auth.uid() = user_id);


-- ┌─────────────────────────────────────────┐
-- │  3. LICENSE_KEYS TABLE                  │
-- │  ทุกคนอ่านได้ (ตรวจสอบ key)              │
-- │  แก้ไข/ลบ ไม่ได้ (Admin ทำผ่าน Dashboard) │
-- └─────────────────────────────────────────┘

ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read license keys" ON license_keys;

-- SELECT: ทุกคน (anon + authenticated) อ่านได้ — เพื่อ validate key
CREATE POLICY "Anyone can read license keys"
  ON license_keys FOR SELECT
  USING (true);

-- ไม่มี INSERT/UPDATE/DELETE policy สำหรับ user
-- → เฉพาะ Admin (service_role key หรือ Dashboard) เท่านั้นที่แก้ได้


-- ┌─────────────────────────────────────────┐
-- │  4. DEVICE_ACTIVATIONS TABLE            │
-- │  ทุกคนอ่าน/เขียนได้ (ลงทะเบียนอุปกรณ์)    │
-- └─────────────────────────────────────────┘

ALTER TABLE device_activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read device activations" ON device_activations;
DROP POLICY IF EXISTS "Anyone can insert device activations" ON device_activations;
DROP POLICY IF EXISTS "Anyone can update device activations" ON device_activations;

-- SELECT: อ่านได้ (เช็คจำนวน device)
CREATE POLICY "Anyone can read device activations"
  ON device_activations FOR SELECT
  USING (true);

-- INSERT: ลงทะเบียนอุปกรณ์ใหม่ได้
CREATE POLICY "Anyone can insert device activations"
  ON device_activations FOR INSERT
  WITH CHECK (true);

-- UPDATE: อัปเดต last_seen ได้
CREATE POLICY "Anyone can update device activations"
  ON device_activations FOR UPDATE
  USING (true);


-- ┌─────────────────────────────────────────┐
-- │  5. เพิ่ม bound_user_id ใน license_keys │
-- │  ผูก license กับ user account           │
-- └─────────────────────────────────────────┘

-- เพิ่มคอลัมน์ bound_user_id (UUID, nullable, references auth.users)
ALTER TABLE license_keys
  ADD COLUMN IF NOT EXISTS bound_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- สร้าง index เพื่อให้ query ด้วย bound_user_id เร็ว
CREATE INDEX IF NOT EXISTS idx_license_keys_bound_user_id
  ON license_keys(bound_user_id);

-- อัปเดต RLS: authenticated user สามารถ update bound_user_id ของ license ได้
-- (เฉพาะ license ที่ยังไม่ถูกผูก หรือผูกกับตัวเอง)
DROP POLICY IF EXISTS "Users can bind license to own account" ON license_keys;

CREATE POLICY "Users can bind license to own account"
  ON license_keys FOR UPDATE
  USING (
    bound_user_id IS NULL           -- ยังไม่ถูกผูก
    OR bound_user_id = auth.uid()   -- หรือผูกกับตัวเองอยู่แล้ว
  )
  WITH CHECK (
    bound_user_id = auth.uid()      -- ผูกได้กับตัวเองเท่านั้น
  );


-- ┌─────────────────────────────────────────┐
-- │  6. ADMIN OPERATIONS                   │
-- │  เฉพาะ admin email เท่านั้นที่สร้าง/ลบ   │
-- │  license ได้                            │
-- └─────────────────────────────────────────┘

-- สร้าง function เช็ค admin email (เปลี่ยน email ได้ตามต้องการ)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  ) IN (
    'admin@grandstate.co'
    -- เพิ่ม admin email ได้ที่นี่ เช่น:
    -- , 'another-admin@email.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin สร้าง license key ได้
DROP POLICY IF EXISTS "Admin can insert license keys" ON license_keys;
CREATE POLICY "Admin can insert license keys"
  ON license_keys FOR INSERT
  WITH CHECK (is_admin());

-- Admin ลบ license key ได้
DROP POLICY IF EXISTS "Admin can delete license keys" ON license_keys;
CREATE POLICY "Admin can delete license keys"
  ON license_keys FOR DELETE
  USING (is_admin());

-- Admin ลบ device activations ได้
DROP POLICY IF EXISTS "Admin can delete device activations" ON device_activations;
CREATE POLICY "Admin can delete device activations"
  ON device_activations FOR DELETE
  USING (is_admin());


-- ══════════════════════════════════════════════════════════════
--  เสร็จ! ตรวจสอบผลได้ที่:
--  Supabase Dashboard → Authentication → Policies
-- ══════════════════════════════════════════════════════════════

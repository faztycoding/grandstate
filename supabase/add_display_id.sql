-- =============================================
-- ADD display_id COLUMN TO users TABLE
-- Format: GS###XX (e.g. GS001AB, GS042ZK)
-- =============================================

-- 1. Add the column (nullable first so existing rows don't break)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_id TEXT UNIQUE;

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_display_id ON public.users(display_id);

-- 3. Function to generate unique GS###XX IDs
CREATE OR REPLACE FUNCTION public.generate_display_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  num_part INTEGER;
  letter1 CHAR(1);
  letter2 CHAR(1);
  exists_count INTEGER;
BEGIN
  LOOP
    -- Random 3-digit number (001-999)
    num_part := floor(random() * 999 + 1)::INTEGER;
    -- Random 2 uppercase letters
    letter1 := chr(floor(random() * 26 + 65)::INTEGER);
    letter2 := chr(floor(random() * 26 + 65)::INTEGER);
    -- Combine: GS###XX
    new_id := 'GS' || lpad(num_part::TEXT, 3, '0') || letter1 || letter2;
    -- Check uniqueness
    SELECT COUNT(*) INTO exists_count FROM public.users WHERE display_id = new_id;
    IF exists_count = 0 THEN
      RETURN new_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Assign display_id to ALL existing users who don't have one
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.users WHERE display_id IS NULL
  LOOP
    UPDATE public.users SET display_id = public.generate_display_id() WHERE id = r.id;
  END LOOP;
END;
$$;

-- 5. Update handle_new_user trigger to auto-assign display_id on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, display_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    public.generate_display_id()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify
SELECT id, email, display_id FROM public.users;

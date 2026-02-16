-- Add proxy_url column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS proxy_url TEXT;

-- Update RLS policies to allow users to read/update their own proxy_url (already covered by existing policies)
-- Existing policies:
-- "Users can view own profile" -> SELECT using (auth.uid() = id)
-- "Users can update own profile" -> UPDATE using (auth.uid() = id)

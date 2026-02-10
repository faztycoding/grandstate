import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface DbProperty {
  id: string;
  user_id: string;
  title: string;
  listing_type: 'sale' | 'rent';
  property_type: string;
  price: number;
  area_size: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  location: string;
  province: string | null;
  district: string | null;
  description: string | null;
  features: string[] | null;
  images: string[] | null;
  status: 'active' | 'inactive' | 'sold' | 'rented';
  created_at: string;
  updated_at: string;
}

export interface DbFacebookGroup {
  id: string;
  user_id: string;
  name: string;
  url: string;
  group_id: string;
  member_count: number | null;
  posts_today: number | null;
  posts_last_month: number | null;
  is_active: boolean;
  last_posted: string | null;
  last_updated: string | null;
  created_at: string;
}

export interface DbUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  package: 'free' | 'starter' | 'top_agent' | 'elite';
  created_at: string;
}

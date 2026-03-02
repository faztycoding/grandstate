-- Migration: Add contact columns to properties table
-- Run this in Supabase SQL Editor

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_line TEXT;

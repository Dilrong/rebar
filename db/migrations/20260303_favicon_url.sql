-- Add favicon_url column to records table for storing site favicons fetched at capture time
ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS favicon_url TEXT;

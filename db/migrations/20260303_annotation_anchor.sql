-- Migration: Add anchor column to annotations for inline highlight support
-- The anchor stores the exact selected text snippet used for matching highlights in the article body.

ALTER TABLE public.annotations
  ADD COLUMN IF NOT EXISTS anchor TEXT;

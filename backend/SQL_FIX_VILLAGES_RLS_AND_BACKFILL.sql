-- ============================================================================
-- Hotfix: villages table access for anon frontend + backfill from accounts
-- Run this once in Supabase SQL Editor on existing DB
-- ============================================================================

BEGIN;

ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;

-- Remove old policy names if they exist
DROP POLICY IF EXISTS villages_select_authenticated ON public.villages;
DROP POLICY IF EXISTS villages_insert_authenticated ON public.villages;
DROP POLICY IF EXISTS villages_update_authenticated ON public.villages;
DROP POLICY IF EXISTS villages_delete_authenticated ON public.villages;
DROP POLICY IF EXISTS villages_select_access ON public.villages;
DROP POLICY IF EXISTS villages_insert_access ON public.villages;
DROP POLICY IF EXISTS villages_update_access ON public.villages;
DROP POLICY IF EXISTS villages_delete_access ON public.villages;

-- Allow access for both anon and authenticated roles
CREATE POLICY villages_select_access
ON public.villages FOR SELECT
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY villages_insert_access
ON public.villages FOR INSERT
WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY villages_update_access
ON public.villages FOR UPDATE
USING (auth.role() IN ('anon', 'authenticated'))
WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY villages_delete_access
ON public.villages FOR DELETE
USING (auth.role() IN ('anon', 'authenticated'));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.villages TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.villages_id_seq TO anon, authenticated;

-- Keep blank/default row required by accounts.village default ''
INSERT INTO public.villages (village_name)
VALUES ('')
ON CONFLICT (village_name) DO NOTHING;

-- Backfill villages from existing accounts
INSERT INTO public.villages (village_name)
SELECT DISTINCT COALESCE(a.village, '')
FROM public.accounts a
ON CONFLICT (village_name) DO NOTHING;

COMMIT;

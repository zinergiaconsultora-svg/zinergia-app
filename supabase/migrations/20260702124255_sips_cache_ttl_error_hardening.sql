-- =============================================
-- SIPS CACHE TTL — align cache retention to 7 days
-- =============================================
-- SPEC-cnmc-sips defines a 7-day TTL. Existing schema default used 30 days;
-- keep rows but cap any future/active expiry to fetched_at + 7 days.

ALTER TABLE public.sips_consumption_cache
    ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

UPDATE public.sips_consumption_cache
SET expires_at = LEAST(expires_at, fetched_at + interval '7 days')
WHERE expires_at > fetched_at + interval '7 days';

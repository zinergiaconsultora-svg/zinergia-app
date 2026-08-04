-- ZIN-SDD-041 / T16 corrective contract migration.
-- These policies predate the migration source-of-truth and were discovered by
-- the effective staging catalog verifier. Keep the removal versioned so fresh
-- environments converge to the same one-policy SELECT-only boundary.

BEGIN;

DROP POLICY IF EXISTS rls_profiles_auth_select ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_auth_update ON public.profiles;

COMMIT;

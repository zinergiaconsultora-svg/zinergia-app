-- ZIN-SDD-041 / T16 corrective contract migration.
-- The first contract migration closed browser writes. This additive correction
-- makes the canonical tuple shape impossible to bypass and removes the
-- concurrency token from all direct browser projections.

BEGIN;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_authority_tuple_check,
    ADD CONSTRAINT profiles_authority_tuple_check CHECK (
        (role IS NULL AND parent_id IS NULL AND franchise_id IS NULL)
        OR (role = 'admin' AND parent_id IS NULL AND franchise_id IS NULL)
        OR (role IN ('franchise', 'agent') AND parent_id IS NOT NULL AND franchise_id IS NOT NULL)
    );

REVOKE SELECT (authority_version) ON TABLE public.profiles
    FROM PUBLIC, anon, authenticated;

COMMENT ON CONSTRAINT profiles_authority_tuple_check ON public.profiles IS
    'ZIN-SDD-041: authority tuple shape; commands additionally validate active references and role relationships under lock.';

COMMIT;

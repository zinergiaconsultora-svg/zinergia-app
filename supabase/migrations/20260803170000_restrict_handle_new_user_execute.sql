-- ZIN-SDD-041 staging-discovered ACL hardening.
-- CREATE OR REPLACE preserves pre-existing grants, so explicitly remove every
-- application-facing executor before restoring Auth's internal trigger role.

BEGIN;

REVOKE ALL ON FUNCTION public.handle_new_user()
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.handle_new_user()
    TO supabase_auth_admin;

COMMIT;

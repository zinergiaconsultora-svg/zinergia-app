-- ZIN-SDD-041: correct inherited legacy EXECUTE ACL on the Auth bootstrap.
-- CREATE OR REPLACE preserves pre-existing explicit function grants, so the
-- expansion migration cannot remove an old service_role grant unless it is
-- revoked explicitly. Auth itself invokes this function as supabase_auth_admin.

BEGIN;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

DO $$
BEGIN
    IF has_function_privilege('service_role', 'public.handle_new_user()'::regprocedure, 'EXECUTE')
       OR NOT has_function_privilege('supabase_auth_admin', 'public.handle_new_user()'::regprocedure, 'EXECUTE') THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'AUTH_BOOTSTRAP_EXECUTE_ACL_INVALID';
    END IF;
END;
$$;

COMMIT;

-- ZIN-SDD-041 T3. Catalog-only verifier; expected RED until expand + contract exist.
-- It is always executed through an explicit staging DB URL by verify-staging.mjs.
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';

DO $$
DECLARE
    safe_profile_columns constant text[] := ARRAY[
        'bio', 'created_at', 'email', 'franchise_id', 'full_name', 'id',
        'parent_id', 'phone', 'role', 'timezone', 'updated_at'
    ];
    protected_name_pattern constant text := '(iban|fiscal|drive|invoice|nif|dni|cups|password|token|secret|raw_|email|phone|full_name)';
    required_rpcs constant text[] := ARRAY[
        'update_own_profile',
        'update_team_member_name',
        'change_profile_authority',
        'begin_profile_invitation_provisioning',
        'record_profile_invitation_auth_user',
        'finalize_profile_invitation_authority',
        'complete_profile_invitation_provisioning',
        'reconcile_profile_invitation_provisioning'
    ];
    protected_tables text[];
    browser_denied_tables text[];
    actual_columns text[];
    rpc_name text;
    rpc_oid oid;
    rate_limit_table regclass;
    bootstrap_oid oid;
    bootstrap_owner text;
    bootstrap_definition text;
BEGIN
    IF to_regclass('public.profiles') IS NULL
       OR to_regclass('public.profile_authority_events') IS NULL
       OR to_regclass('public.profile_invitation_provisioning') IS NULL THEN
        RAISE EXCEPTION 'RED: missing profiles, authority events or invitation provisioning relation';
    END IF;

    SELECT c.oid::regclass INTO rate_limit_table
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND c.relname ~ 'rate_limit'
      AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
            AND a.attname ~ '(hash|key)'
      )
      AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
            AND a.attname ~ '(expires|window)'
      );
    IF rate_limit_table IS NULL THEN
        RAISE EXCEPTION 'RED: missing shared peppered rate-limit relation';
    END IF;
    protected_tables := ARRAY[
        'public.profile_authority_events',
        'public.profile_invitation_provisioning',
        'public.' || rate_limit_table::text
    ];
    browser_denied_tables := ARRAY[
        'public.profile_invitation_provisioning',
        'public.' || rate_limit_table::text
    ];

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name = 'authority_version' AND is_nullable = 'NO'
          AND column_default ~ '0'
    ) THEN
        RAISE EXCEPTION 'RED: profiles.authority_version is not NOT NULL DEFAULT 0';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ~* 'role'
          AND pg_get_constraintdef(oid) ~* 'parent_id'
          AND pg_get_constraintdef(oid) ~* 'franchise_id'
    ) THEN
        RAISE EXCEPTION 'RED: profiles lacks a canonical authority-tuple constraint';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'network_invitations'
          AND column_name = 'target_franchise_id'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.network_invitations'::regclass AND contype = 'f'
          AND pg_get_constraintdef(oid) ~* 'target_franchise_id'
    ) THEN
        RAISE EXCEPTION 'RED: invitation target-franchise constraint is absent';
    END IF;

    -- Complete effective table/column grant contract for all four role classes.
    IF EXISTS (
        SELECT 1 FROM information_schema.table_privileges
        WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'PUBLIC'
    ) OR EXISTS (
        SELECT 1 FROM information_schema.column_privileges
        WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'PUBLIC'
    ) THEN
        RAISE EXCEPTION 'RED: PUBLIC retains a profiles table/column grant';
    END IF;
    IF has_table_privilege('anon', 'public.profiles', 'SELECT')
       OR has_table_privilege('anon', 'public.profiles', 'INSERT')
       OR has_table_privilege('anon', 'public.profiles', 'UPDATE')
       OR has_table_privilege('anon', 'public.profiles', 'DELETE')
       OR EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'profiles'
             AND (has_column_privilege('anon', 'public.profiles', c.column_name, 'SELECT')
                  OR has_column_privilege('anon', 'public.profiles', c.column_name, 'INSERT')
                  OR has_column_privilege('anon', 'public.profiles', c.column_name, 'UPDATE'))
       ) THEN
        RAISE EXCEPTION 'RED: anon retains a profiles privilege';
    END IF;
    IF has_table_privilege('authenticated', 'public.profiles', 'SELECT')
       OR has_table_privilege('authenticated', 'public.profiles', 'INSERT')
       OR has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.profiles', 'DELETE')
       OR EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'profiles'
             AND (has_column_privilege('authenticated', 'public.profiles', c.column_name, 'INSERT')
                  OR has_column_privilege('authenticated', 'public.profiles', c.column_name, 'UPDATE'))
       ) THEN
        RAISE EXCEPTION 'RED: authenticated retains broad profiles privilege';
    END IF;
    SELECT coalesce(array_agg(c.column_name ORDER BY c.column_name), ARRAY[]::text[])
    INTO actual_columns
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'profiles'
      AND has_column_privilege('authenticated', 'public.profiles', c.column_name, 'SELECT');
    IF actual_columns <> safe_profile_columns THEN
        RAISE EXCEPTION 'RED: authenticated profiles projection is %, expected %', actual_columns, safe_profile_columns;
    END IF;
    IF NOT has_table_privilege('service_role', 'public.profiles', 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.profiles', 'INSERT')
       OR NOT has_table_privilege('service_role', 'public.profiles', 'UPDATE')
       OR NOT has_table_privilege('service_role', 'public.profiles', 'DELETE') THEN
        RAISE EXCEPTION 'RED: service_role lacks the canonical server profiles privileges';
    END IF;

    FOREACH rpc_name IN ARRAY browser_denied_tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_schema = split_part(rpc_name, '.', 1)
              AND table_name = split_part(rpc_name, '.', 2)
              AND grantee = 'PUBLIC'
        ) OR EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE table_schema = split_part(rpc_name, '.', 1)
              AND table_name = split_part(rpc_name, '.', 2)
              AND grantee = 'PUBLIC'
        ) OR has_table_privilege('anon', rpc_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
           OR has_table_privilege('authenticated', rpc_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
           OR EXISTS (
               SELECT 1 FROM information_schema.columns c
               WHERE c.table_schema = split_part(rpc_name, '.', 1)
                 AND c.table_name = split_part(rpc_name, '.', 2)
                 AND (has_column_privilege('anon', rpc_name, c.column_name, 'SELECT')
                      OR has_column_privilege('anon', rpc_name, c.column_name, 'INSERT')
                      OR has_column_privilege('anon', rpc_name, c.column_name, 'UPDATE')
                      OR has_column_privilege('authenticated', rpc_name, c.column_name, 'SELECT')
                      OR has_column_privilege('authenticated', rpc_name, c.column_name, 'INSERT')
                      OR has_column_privilege('authenticated', rpc_name, c.column_name, 'UPDATE'))
           ) THEN
            RAISE EXCEPTION 'RED: browser role retains privilege on %', rpc_name;
        END IF;
    END LOOP;
    IF NOT has_table_privilege('service_role', 'public.profile_authority_events', 'SELECT,INSERT')
       OR has_table_privilege('service_role', 'public.profile_authority_events', 'UPDATE,DELETE,TRUNCATE') THEN
        RAISE EXCEPTION 'RED: authority-event service grants are not append-only';
    END IF;
    IF NOT has_table_privilege('service_role', 'public.profile_invitation_provisioning', 'SELECT,INSERT,UPDATE,DELETE')
       OR NOT has_table_privilege('service_role', rate_limit_table, 'SELECT,INSERT,UPDATE,DELETE') THEN
        RAISE EXCEPTION 'RED: service_role lacks provisioning/rate-limit lifecycle grants';
    END IF;

    -- RLS and policy shapes: profiles is authenticated SELECT-only; internal tables
    -- have no browser policy path at all.
    IF EXISTS (
        SELECT 1 FROM unnest(ARRAY['public.profiles'] || protected_tables) AS r(name)
        JOIN pg_class c ON c.oid = r.name::regclass
        WHERE NOT c.relrowsecurity
    ) THEN
        RAISE EXCEPTION 'RED: an exposed authority relation lacks RLS';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles'
          AND cmd = 'SELECT' AND roles = ARRAY['authenticated']::name[]
    ) OR EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd <> 'SELECT'
    ) THEN
        RAISE EXCEPTION 'RED: profiles policies are not authenticated SELECT-only';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = 'profile_authority_events'
          AND p.cmd = 'SELECT' AND p.roles = ARRAY['authenticated']::name[]
          AND coalesce(p.qual, '') ~* '(is_admin|admin.*profile|profile.*admin)'
    ) OR EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = 'profile_authority_events'
          AND (p.roles && ARRAY['public', 'anon', 'authenticated']::name[])
          AND NOT (
              p.cmd = 'SELECT' AND p.roles = ARRAY['authenticated']::name[]
              AND coalesce(p.qual, '') ~* '(is_admin|admin.*profile|profile.*admin)'
          )
    ) THEN
        RAISE EXCEPTION 'RED: authority events lack the sole approved authenticated Admin SELECT policy';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE ('public.' || p.tablename) = ANY (browser_denied_tables)
          AND (p.roles && ARRAY['public', 'anon', 'authenticated']::name[])
    ) THEN
        RAISE EXCEPTION 'RED: provisioning/rate-limit relation has a browser policy';
    END IF;

    -- Required constraints and safe storage shape.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profile_authority_events'::regclass AND contype = 'u'
          AND pg_get_constraintdef(oid) ~* '\(request_id\)'
    ) OR EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profile_authority_events'::regclass
          AND contype = 'f' AND confdeltype = 'c'
    ) OR EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_authority_events'
          AND column_name ~* protected_name_pattern
    ) THEN
        RAISE EXCEPTION 'RED: authority-event uniqueness, FK retention or safe-column contract failed';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profile_invitation_provisioning'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE ALL (ARRAY[
              '%prepared%', '%auth_created_blocked%', '%authority_committed%', '%completed%', '%needs_reconciliation%'
          ])
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profile_invitation_provisioning'::regclass AND contype = 'u'
          AND pg_get_constraintdef(oid) ~* '\(invitation_id\)'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profile_invitation_provisioning'::regclass AND contype = 'u'
          AND pg_get_constraintdef(oid) ~* '\(request_id\)'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profile_invitation_provisioning'::regclass AND contype = 'u'
          AND pg_get_constraintdef(oid) ~* '\((auth_)?user_id\)'
    ) OR EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_invitation_provisioning'
          AND column_name ~* '(email|password|token|raw_ip)'
    ) THEN
        RAISE EXCEPTION 'RED: provisioning status/uniqueness/no-PII contract failed';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = regexp_replace(rate_limit_table::text, '^.*\\.', '')
          AND indexdef ~* '(expires|window)'
    ) OR EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = regexp_replace(rate_limit_table::text, '^.*\\.', '')
          AND column_name ~* '(email|raw_ip|password|token)'
    ) THEN
        RAISE EXCEPTION 'RED: rate-limit expiry index or peppered-identifier contract failed';
    END IF;

    -- Every public command/wrapper is invoker-rights, has exactly empty search_path,
    -- and is executable only by service_role.
    FOREACH rpc_name IN ARRAY required_rpcs LOOP
        SELECT p.oid INTO rpc_oid
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = rpc_name;
        IF rpc_oid IS NULL THEN RAISE EXCEPTION 'RED: missing RPC/wrapper public.%', rpc_name; END IF;
        IF (SELECT prosecdef FROM pg_proc WHERE oid = rpc_oid)
           OR NOT (SELECT coalesce(proconfig, ARRAY[]::text[]) = ARRAY['search_path=""'] FROM pg_proc WHERE oid = rpc_oid)
           OR EXISTS (
               SELECT 1
               FROM pg_proc fp
               CROSS JOIN LATERAL aclexplode(coalesce(fp.proacl, acldefault('f', fp.proowner))) acl
               WHERE fp.oid = rpc_oid AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
           )
           OR has_function_privilege('anon', rpc_oid, 'EXECUTE')
           OR has_function_privilege('authenticated', rpc_oid, 'EXECUTE')
           OR NOT has_function_privilege('service_role', rpc_oid, 'EXECUTE') THEN
            RAISE EXCEPTION 'RED: unsafe invoker/search_path/EXECUTE contract for public.%', rpc_name;
        END IF;
    END LOOP;

    SELECT p.oid, owner.rolname, pg_get_functiondef(p.oid)
    INTO bootstrap_oid, bootstrap_owner, bootstrap_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles owner ON owner.oid = p.proowner
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';
    IF bootstrap_oid IS NULL OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = bootstrap_oid)
       OR bootstrap_owner NOT IN ('postgres', 'supabase_admin')
       OR NOT (SELECT coalesce(proconfig, ARRAY[]::text[]) = ARRAY['search_path=""'] FROM pg_proc WHERE oid = bootstrap_oid)
       OR EXISTS (
           SELECT 1
           FROM pg_proc fp
           CROSS JOIN LATERAL aclexplode(coalesce(fp.proacl, acldefault('f', fp.proowner))) acl
           WHERE fp.oid = bootstrap_oid AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
       )
       OR has_function_privilege('anon', bootstrap_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', bootstrap_oid, 'EXECUTE')
       OR bootstrap_definition !~* 'role[^;]*null'
       OR bootstrap_definition !~* 'parent_id[^;]*null'
       OR bootstrap_definition !~* 'franchise_id[^;]*null'
       OR bootstrap_definition ~* '''agent'''
       OR NOT EXISTS (
           SELECT 1 FROM pg_trigger t
           WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal
             AND t.tgfoid = bootstrap_oid AND pg_get_triggerdef(t.oid) ILIKE '%AFTER INSERT%'
       ) THEN
        RAISE EXCEPTION 'RED: neutral Auth bootstrap definition/binding is unsafe';
    END IF;

    -- Canonical guards: row UPDATE/DELETE + statement TRUNCATE on events, and a
    -- BEFORE UPDATE authority guard on profiles that routes canonical context.
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = 'public.profile_authority_events'::regclass
          AND NOT t.tgisinternal
          AND (pg_get_triggerdef(t.oid) ILIKE '%UPDATE OR DELETE%'
               OR pg_get_triggerdef(t.oid) ILIKE '%DELETE OR UPDATE%')
          AND pg_get_triggerdef(t.oid) ILIKE '%FOR EACH ROW%'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = 'public.profile_authority_events'::regclass
          AND NOT t.tgisinternal AND pg_get_triggerdef(t.oid) ILIKE '%TRUNCATE%'
          AND pg_get_triggerdef(t.oid) ILIKE '%FOR EACH STATEMENT%'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgrelid = 'public.profiles'::regclass AND NOT t.tgisinternal
          AND pg_get_triggerdef(t.oid) ILIKE '%BEFORE UPDATE%'
          AND p.proname ~ '(authority|profile).*guard|guard.*(authority|profile)'
          AND pg_get_functiondef(p.oid) ~* '(role|parent_id|franchise_id|authority_version)'
    ) THEN
        RAISE EXCEPTION 'RED: canonical event/profile guard triggers are incomplete';
    END IF;
    IF pg_get_functiondef('private.profile_authority_guard()'::regprocedure)
       !~* 'AUTHORITY_CONTEXT_REQUIRED'
       OR pg_get_functiondef('private.profile_authority_guard()'::regprocedure)
          ~* 'profile_authority_legacy_write' THEN
        RAISE EXCEPTION 'RED: authority guard remains in compatibility mode';
    END IF;
END
$$;

ROLLBACK;
SELECT 'ok' AS profile_authority_structure_verification;

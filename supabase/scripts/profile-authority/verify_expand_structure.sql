-- ZIN-SDD-041 / T6: catalog-only verifier for the additive expansion checkpoint.
--
-- This verifier is intentionally phase-specific. It proves that the expansion
-- objects are installed and protected while the inventoried broad profiles
-- compatibility writer and compatibility guard are still present. It must fail
-- after the final contract cutover; verify_structure.sql owns that later gate.
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';

DO $$
DECLARE
    internal_tables constant text[] := ARRAY[
        'public.profile_invitation_provisioning',
        'public.profile_join_rate_limits',
        'public.profile_join_rate_limit_receipts'
    ];
    all_new_tables constant text[] := ARRAY[
        'public.profile_authority_events',
        'public.profile_invitation_provisioning',
        'public.profile_join_rate_limits',
        'public.profile_join_rate_limit_receipts'
    ];
    required_rpc_signatures constant text[] := ARRAY[
        'public.update_own_profile(uuid,text,text,text,text)',
        'public.update_team_member_name(uuid,uuid,text)',
        'public.change_profile_authority(uuid,uuid,text,uuid,uuid,bigint,text,uuid)',
        'public.consume_profile_join_rate_limit(text,text)',
        'public.claim_profile_join_rate_limit_receipt(uuid,uuid,uuid,text)',
        'public.begin_profile_invitation_provisioning(uuid,text,uuid,uuid,text)',
        'public.record_profile_invitation_auth_user(uuid,uuid,timestamp with time zone)',
        'public.finalize_profile_invitation_authority(uuid,text,timestamp with time zone)',
        'public.complete_profile_invitation_provisioning(uuid,uuid,timestamp with time zone)',
        'public.reconcile_profile_invitation_provisioning(uuid,text,integer)'
    ];
    service_private_signatures constant text[] := ARRAY[
        'private.profile_authority_state(text,uuid,uuid)',
        'private.finalize_profile_invitation_authority_core(uuid,text,timestamp with time zone)'
    ];
    trigger_only_private_signatures constant text[] := ARRAY[
        'private.prevent_profile_authority_event_mutation()',
        'private.profile_authority_guard()',
        'private.audit_profile_authority_change()'
    ];
    relation_name text;
    signature text;
    relation_oid regclass;
    function_oid oid;
    function_definition text;
    guard_oid oid;
    guard_definition text;
    audit_oid oid;
    audit_definition text;
    bootstrap_oid oid;
    bootstrap_owner text;
    bootstrap_definition text;
    consume_definition text;
    claim_definition text;
    begin_definition text;
    immutable_definition text;
    profile_writer_trigger_count integer;
BEGIN
    -- Additive relations and columns exist without requiring the later canonical
    -- profiles CHECK constraint or rewriting any existing authority tuple.
    FOREACH relation_name IN ARRAY all_new_tables LOOP
        IF to_regclass(relation_name) IS NULL THEN
            RAISE EXCEPTION 'EXPAND RED: missing relation %', relation_name;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'profiles'
          AND c.column_name = 'authority_version'
          AND c.data_type = 'bigint'
          AND c.is_nullable = 'NO'
          AND c.column_default ~ '0'
    ) THEN
        RAISE EXCEPTION 'EXPAND RED: profiles.authority_version is not bigint NOT NULL DEFAULT 0';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'network_invitations'
          AND c.column_name = 'target_franchise_id'
          AND c.data_type = 'uuid'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = 'public.network_invitations'::regclass
          AND constraint_row.confrelid = 'public.franchises'::regclass
          AND constraint_row.contype = 'f'
          AND constraint_row.convalidated
          AND pg_get_constraintdef(constraint_row.oid) ~* 'FOREIGN KEY\s*\(target_franchise_id\)'
    ) THEN
        RAISE EXCEPTION 'EXPAND RED: validated target_franchise_id FK is absent';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = 'public.network_invitations'::regclass
          AND constraint_row.confrelid = 'public.profiles'::regclass
          AND constraint_row.contype = 'f'
          AND constraint_row.convalidated
          AND pg_get_constraintdef(constraint_row.oid) ~* 'FOREIGN KEY\s*\(creator_id\)'
    ) THEN
        RAISE EXCEPTION 'EXPAND RED: invitation creator FK is absent';
    END IF;

    -- The expansion checkpoint must not silently become the final contract.
    -- Both the effective broad UPDATE grant/policy and the explicit compatibility
    -- guard branch remain until the compatible application has converged.
    IF NOT has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policies policy
           WHERE policy.schemaname = 'public'
             AND policy.tablename = 'profiles'
             AND policy.cmd = 'UPDATE'
             AND policy.roles && ARRAY['public', 'authenticated']::name[]
       ) THEN
        RAISE EXCEPTION 'EXPAND RED: broad profiles compatibility writer is absent; contract may have been applied early';
    END IF;

    SELECT proc.oid, pg_get_functiondef(proc.oid)
    INTO guard_oid, guard_definition
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'private'
      AND proc.proname = 'profile_authority_guard'
      AND proc.pronargs = 0;

    IF guard_oid IS NULL
       OR (SELECT prosecdef FROM pg_proc WHERE oid = guard_oid)
       OR NOT (SELECT coalesce(proconfig, ARRAY[]::text[]) = ARRAY['search_path=""'] FROM pg_proc WHERE oid = guard_oid)
       OR guard_definition !~* 'current_setting\(''app\.profile_authority_context'''
       OR guard_definition !~* 'profile_authority_legacy_write'
       OR guard_definition !~* 'NEW\.authority_version\s*:=\s*OLD\.authority_version\s*\+\s*1'
       OR guard_definition !~* 'RETURN\s+NEW'
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger trigger_row
           WHERE trigger_row.tgrelid = 'public.profiles'::regclass
             AND NOT trigger_row.tgisinternal
             AND trigger_row.tgfoid = guard_oid
             AND trigger_row.tgenabled <> 'D'
             AND pg_get_triggerdef(trigger_row.oid) ILIKE '%BEFORE UPDATE%'
       ) THEN
        RAISE EXCEPTION 'EXPAND RED: authority guard is absent, unsafe, or no longer in compatibility mode';
    END IF;

    SELECT proc.oid, pg_get_functiondef(proc.oid)
    INTO audit_oid, audit_definition
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'private'
      AND proc.proname = 'audit_profile_authority_change'
      AND proc.pronargs = 0;

    IF audit_oid IS NULL
       OR (SELECT prosecdef FROM pg_proc WHERE oid = audit_oid)
       OR NOT (SELECT coalesce(proconfig, ARRAY[]::text[]) = ARRAY['search_path=""'] FROM pg_proc WHERE oid = audit_oid)
       OR audit_definition !~* 'INSERT\s+INTO\s+public\.profile_authority_events'
       OR audit_definition !~* 'app\.profile_authority_context'
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger trigger_row
           WHERE trigger_row.tgrelid = 'public.profiles'::regclass
             AND NOT trigger_row.tgisinternal
             AND trigger_row.tgfoid = audit_oid
             AND trigger_row.tgenabled <> 'D'
             AND pg_get_triggerdef(trigger_row.oid) ILIKE '%AFTER UPDATE%'
       ) THEN
        RAISE EXCEPTION 'EXPAND RED: canonical authority audit trigger is absent or unsafe';
    END IF;

    -- RLS is mandatory on every newly exposed relation.
    FOREACH relation_name IN ARRAY all_new_tables LOOP
        relation_oid := to_regclass(relation_name);
        IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = relation_oid) THEN
            RAISE EXCEPTION 'EXPAND RED: RLS is disabled on %', relation_name;
        END IF;
    END LOOP;

    -- Authority events are Admin-readable and service append-only. Browser roles
    -- cannot append or mutate, including through separately granted columns.
    IF has_table_privilege('anon', 'public.profile_authority_events', 'SELECT')
       OR has_table_privilege('anon', 'public.profile_authority_events', 'INSERT')
       OR has_table_privilege('anon', 'public.profile_authority_events', 'UPDATE')
       OR has_table_privilege('anon', 'public.profile_authority_events', 'DELETE')
       OR NOT has_table_privilege('authenticated', 'public.profile_authority_events', 'SELECT')
       OR has_table_privilege('authenticated', 'public.profile_authority_events', 'INSERT')
       OR has_table_privilege('authenticated', 'public.profile_authority_events', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.profile_authority_events', 'DELETE')
       OR NOT has_table_privilege('service_role', 'public.profile_authority_events', 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.profile_authority_events', 'INSERT')
       OR has_table_privilege('service_role', 'public.profile_authority_events', 'UPDATE')
       OR has_table_privilege('service_role', 'public.profile_authority_events', 'DELETE')
       OR has_table_privilege('service_role', 'public.profile_authority_events', 'TRUNCATE')
       OR EXISTS (
           SELECT 1
           FROM information_schema.table_privileges privilege
           WHERE privilege.table_schema = 'public'
             AND privilege.table_name = 'profile_authority_events'
             AND privilege.grantee = 'PUBLIC'
       ) OR EXISTS (
           SELECT 1
           FROM information_schema.column_privileges privilege
           WHERE privilege.table_schema = 'public'
             AND privilege.table_name = 'profile_authority_events'
             AND privilege.grantee IN ('PUBLIC', 'anon', 'authenticated')
             AND privilege.privilege_type IN ('INSERT', 'UPDATE')
       ) THEN
        RAISE EXCEPTION 'EXPAND RED: authority-event effective ACL is not Admin-read/service-append-only';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies policy
        WHERE policy.schemaname = 'public'
          AND policy.tablename = 'profile_authority_events'
          AND policy.cmd = 'SELECT'
          AND policy.roles = ARRAY['authenticated']::name[]
          AND coalesce(policy.qual, '') ~* '(is_admin|admin)'
    ) OR EXISTS (
        SELECT 1
        FROM pg_policies policy
        WHERE policy.schemaname = 'public'
          AND policy.tablename = 'profile_authority_events'
          AND policy.roles && ARRAY['public', 'anon', 'authenticated']::name[]
          AND NOT (
              policy.cmd = 'SELECT'
              AND policy.roles = ARRAY['authenticated']::name[]
              AND coalesce(policy.qual, '') ~* '(is_admin|admin)'
          )
    ) THEN
        RAISE EXCEPTION 'EXPAND RED: authority-event browser policy surface is not the sole Admin SELECT path';
    END IF;

    -- Internal provisioning/rate-limit relations have no browser ACL or policy,
    -- while service_role retains the lifecycle privileges required by the RPCs.
    FOREACH relation_name IN ARRAY internal_tables LOOP
        IF has_table_privilege('anon', relation_name, 'SELECT')
           OR has_table_privilege('anon', relation_name, 'INSERT')
           OR has_table_privilege('anon', relation_name, 'UPDATE')
           OR has_table_privilege('anon', relation_name, 'DELETE')
           OR has_table_privilege('anon', relation_name, 'TRUNCATE')
           OR has_table_privilege('authenticated', relation_name, 'SELECT')
           OR has_table_privilege('authenticated', relation_name, 'INSERT')
           OR has_table_privilege('authenticated', relation_name, 'UPDATE')
           OR has_table_privilege('authenticated', relation_name, 'DELETE')
           OR has_table_privilege('authenticated', relation_name, 'TRUNCATE')
           OR NOT has_table_privilege('service_role', relation_name, 'SELECT')
           OR NOT has_table_privilege('service_role', relation_name, 'INSERT')
           OR NOT has_table_privilege('service_role', relation_name, 'UPDATE')
           OR NOT has_table_privilege('service_role', relation_name, 'DELETE')
           OR has_table_privilege('service_role', relation_name, 'TRUNCATE')
           OR EXISTS (
               SELECT 1
               FROM information_schema.table_privileges privilege
               WHERE privilege.table_schema = split_part(relation_name, '.', 1)
                 AND privilege.table_name = split_part(relation_name, '.', 2)
                 AND privilege.grantee = 'PUBLIC'
           ) OR EXISTS (
               SELECT 1
               FROM information_schema.column_privileges privilege
               WHERE privilege.table_schema = split_part(relation_name, '.', 1)
                 AND privilege.table_name = split_part(relation_name, '.', 2)
                 AND privilege.grantee IN ('PUBLIC', 'anon', 'authenticated')
                 AND privilege.privilege_type IN ('SELECT', 'INSERT', 'UPDATE')
           ) OR EXISTS (
               SELECT 1
               FROM pg_policies policy
               WHERE ('public.' || policy.tablename) = relation_name
                 AND policy.roles && ARRAY['public', 'anon', 'authenticated']::name[]
           ) THEN
            RAISE EXCEPTION 'EXPAND RED: unsafe browser/service ACL or RLS policy on %', relation_name;
        END IF;
    END LOOP;

    -- Append-only evidence is defended both by ACL and by row/statement triggers.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid = 'public.profile_authority_events'::regclass
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND pg_get_triggerdef(trigger_row.oid) ~* 'BEFORE (?:UPDATE OR DELETE|DELETE OR UPDATE)'
          AND pg_get_triggerdef(trigger_row.oid) ILIKE '%FOR EACH ROW%'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid = 'public.profile_authority_events'::regclass
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
          AND pg_get_triggerdef(trigger_row.oid) ILIKE '%BEFORE TRUNCATE%'
          AND pg_get_triggerdef(trigger_row.oid) ILIKE '%FOR EACH STATEMENT%'
    ) THEN
        RAISE EXCEPTION 'EXPAND RED: authority-event append-only triggers are incomplete';
    END IF;

    immutable_definition := pg_get_functiondef(
        to_regprocedure('private.prevent_profile_authority_event_mutation()')
    );
    IF immutable_definition !~* 'RAISE\s+EXCEPTION'
       OR immutable_definition !~* 'AUTHORITY_EVENT_IMMUTABLE' THEN
        RAISE EXCEPTION 'EXPAND RED: authority-event mutation trigger does not fail closed';
    END IF;

    -- Minimal durable state and receipt contracts. No raw identity, credential or
    -- business payload is permitted in these relations.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = 'public.profile_authority_events'::regclass
          AND constraint_row.contype = 'u'
          AND pg_get_constraintdef(constraint_row.oid) ~* '\(request_id\)'
    ) OR EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'profile_authority_events'
          AND c.column_name ~* '(email|phone|full_name|iban|fiscal|nif|dni|cups|password|token|secret|raw_ip)'
    ) THEN
        RAISE EXCEPTION 'EXPAND RED: authority-event uniqueness or no-PII shape failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = 'public.profile_invitation_provisioning'::regclass
          AND constraint_row.contype = 'c'
          AND pg_get_constraintdef(constraint_row.oid) ILIKE ALL (ARRAY[
              '%prepared%', '%auth_created_blocked%', '%authority_committed%', '%completed%', '%needs_reconciliation%'
          ])
    ) OR (SELECT count(*) FROM pg_constraint constraint_row
          WHERE constraint_row.conrelid = 'public.profile_invitation_provisioning'::regclass
            AND constraint_row.contype = 'u'
            AND pg_get_constraintdef(constraint_row.oid) ~* '\((invitation_id|request_id|auth_user_id)\)') < 3
       OR EXISTS (
           SELECT 1
           FROM information_schema.columns c
           WHERE c.table_schema = 'public'
             AND c.table_name = 'profile_invitation_provisioning'
             AND c.column_name ~* '(email|password|token|raw_ip)'
       ) THEN
        RAISE EXCEPTION 'EXPAND RED: provisioning state/uniqueness/no-PII shape failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'profile_join_rate_limits'
          AND c.column_name = 'identifier_hash'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_indexes index_row
        WHERE index_row.schemaname = 'public'
          AND index_row.tablename = 'profile_join_rate_limits'
          AND index_row.indexdef ~* 'expires_at'
    ) OR EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'profile_join_rate_limits'
          AND c.column_name ~* '(email|raw_ip|password|token|secret)'
    ) THEN
        RAISE EXCEPTION 'EXPAND RED: rate-attempt hash/expiry/no-PII shape failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'profile_join_rate_limit_receipts'
          AND c.column_name = 'source_key_hash'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'profile_join_rate_limit_receipts'
          AND c.column_name = 'identity_key_hash'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'profile_join_rate_limit_receipts'
          AND c.column_name = 'payload_hash'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'profile_join_rate_limit_receipts'
          AND c.column_name = 'claimed_at'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = 'public.profile_join_rate_limit_receipts'::regclass
          AND constraint_row.contype = 'c'
          AND pg_get_constraintdef(constraint_row.oid) ~* 'claimed_at'
          AND pg_get_constraintdef(constraint_row.oid) ~* 'payload_hash'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_indexes index_row
        WHERE index_row.schemaname = 'public'
          AND index_row.tablename = 'profile_join_rate_limit_receipts'
          AND index_row.indexdef ~* 'expires_at'
    ) OR EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = 'public.profile_join_rate_limit_receipts'::regclass
          AND constraint_row.contype = 'u'
          AND pg_get_constraintdef(constraint_row.oid) ~* '^UNIQUE \(request_id\)$'
    ) OR EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'profile_join_rate_limit_receipts'
          AND c.column_name ~* '(email|raw_ip|password|token|secret)'
    ) THEN
        RAISE EXCEPTION 'EXPAND RED: receipt claim/retry/expiry/no-PII shape failed';
    END IF;

    -- Every public command is invoker-rights, pinned to an empty search_path and
    -- executable only by service_role.
    FOREACH signature IN ARRAY required_rpc_signatures LOOP
        function_oid := to_regprocedure(signature);
        IF function_oid IS NULL THEN
            RAISE EXCEPTION 'EXPAND RED: missing RPC %', signature;
        END IF;
        IF (SELECT prosecdef FROM pg_proc WHERE oid = function_oid)
           OR NOT (SELECT coalesce(proconfig, ARRAY[]::text[]) = ARRAY['search_path=""'] FROM pg_proc WHERE oid = function_oid)
           OR EXISTS (
               SELECT 1
               FROM pg_proc proc
               CROSS JOIN LATERAL aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
               WHERE proc.oid = function_oid
                 AND acl.grantee = 0
                 AND acl.privilege_type = 'EXECUTE'
           )
           OR has_function_privilege('anon', function_oid, 'EXECUTE')
           OR has_function_privilege('authenticated', function_oid, 'EXECUTE')
           OR NOT has_function_privilege('service_role', function_oid, 'EXECUTE') THEN
            RAISE EXCEPTION 'EXPAND RED: unsafe SECURITY INVOKER/search_path/EXECUTE contract for %', signature;
        END IF;
    END LOOP;

    -- Private helpers called by SECURITY INVOKER RPCs need service execution but
    -- no browser execution. Trigger-only functions need no direct service path.
    FOREACH signature IN ARRAY service_private_signatures LOOP
        function_oid := to_regprocedure(signature);
        IF function_oid IS NULL
           OR (SELECT prosecdef FROM pg_proc WHERE oid = function_oid)
           OR NOT (SELECT coalesce(proconfig, ARRAY[]::text[]) = ARRAY['search_path=""'] FROM pg_proc WHERE oid = function_oid)
           OR EXISTS (
               SELECT 1
               FROM pg_proc proc
               CROSS JOIN LATERAL aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
               WHERE proc.oid = function_oid
                 AND acl.grantee = 0
                 AND acl.privilege_type = 'EXECUTE'
           )
           OR has_function_privilege('anon', function_oid, 'EXECUTE')
           OR has_function_privilege('authenticated', function_oid, 'EXECUTE')
           OR NOT has_function_privilege('service_role', function_oid, 'EXECUTE') THEN
            RAISE EXCEPTION 'EXPAND RED: unsafe private service dependency %', signature;
        END IF;
    END LOOP;

    FOREACH signature IN ARRAY trigger_only_private_signatures LOOP
        function_oid := to_regprocedure(signature);
        IF function_oid IS NULL
           OR EXISTS (
               SELECT 1
               FROM pg_proc proc
               CROSS JOIN LATERAL aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
               WHERE proc.oid = function_oid
                 AND acl.grantee = 0
                 AND acl.privilege_type = 'EXECUTE'
           )
           OR has_function_privilege('anon', function_oid, 'EXECUTE')
           OR has_function_privilege('authenticated', function_oid, 'EXECUTE')
           OR has_function_privilege('service_role', function_oid, 'EXECUTE') THEN
            RAISE EXCEPTION 'EXPAND RED: trigger-only private function is directly executable: %', signature;
        END IF;
    END LOOP;

    function_definition := pg_get_functiondef(
        to_regprocedure('public.finalize_profile_invitation_authority(uuid,text,timestamp with time zone)')
    );
    IF function_definition !~* 'private\.finalize_profile_invitation_authority_core'
       OR pg_get_functiondef(to_regprocedure(
           'public.change_profile_authority(uuid,uuid,text,uuid,uuid,bigint,text,uuid)'
       )) !~* 'private\.profile_authority_state' THEN
        RAISE EXCEPTION 'EXPAND RED: public RPC to private-helper dependency is absent';
    END IF;

    -- The receipt is a committed, PII-free attempt capability. Claiming binds it
    -- once to the exact invitation/request/payload tuple, and begin rechecks that
    -- durable tuple rather than trusting call order or a comment in application code.
    consume_definition := pg_get_functiondef(
        to_regprocedure('public.consume_profile_join_rate_limit(text,text)')
    );
    claim_definition := pg_get_functiondef(
        to_regprocedure('public.claim_profile_join_rate_limit_receipt(uuid,uuid,uuid,text)')
    );
    begin_definition := pg_get_functiondef(
        to_regprocedure('public.begin_profile_invitation_provisioning(uuid,text,uuid,uuid,text)')
    );
    IF consume_definition !~* 'INSERT\s+INTO\s+public\.profile_join_rate_limits'
       OR consume_definition !~* 'INSERT\s+INTO\s+public\.profile_join_rate_limit_receipts'
       OR consume_definition !~* '''receipt_id'''
       OR claim_definition !~* 'FROM\s+public\.profile_join_rate_limit_receipts[^;]*FOR\s+UPDATE'
       OR claim_definition !~* 'invitation_id\s+IS\s+DISTINCT\s+FROM\s+p_invitation_id'
       OR claim_definition !~* 'request_id\s+IS\s+DISTINCT\s+FROM\s+p_request_id'
       OR claim_definition !~* 'payload_hash\s+IS\s+DISTINCT\s+FROM\s+p_payload_hash'
       OR claim_definition !~* 'claimed_at\s*=\s*now\s*\(\s*\)'
       OR begin_definition !~* 'FROM\s+public\.profile_join_rate_limit_receipts[^;]*FOR\s+UPDATE'
       OR begin_definition !~* 'claimed_at\s+IS\s+NULL'
       OR begin_definition !~* 'expires_at\s*<=\s*v_now'
       OR begin_definition !~* 'invitation_id\s+IS\s+DISTINCT\s+FROM\s+p_invitation_id'
       OR begin_definition !~* 'request_id\s+IS\s+DISTINCT\s+FROM\s+p_request_id'
       OR begin_definition !~* 'payload_hash\s+IS\s+DISTINCT\s+FROM\s+p_payload_hash' THEN
        RAISE EXCEPTION 'EXPAND RED: durable consume/claim/begin receipt correlation is incomplete';
    END IF;

    -- Neutral, non-overwriting Auth bootstrap with one effective profile-writing
    -- AFTER INSERT trigger. Other unrelated Auth triggers are not prohibited.
    SELECT proc.oid, owner.rolname, pg_get_functiondef(proc.oid)
    INTO bootstrap_oid, bootstrap_owner, bootstrap_definition
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    JOIN pg_roles owner ON owner.oid = proc.proowner
    WHERE namespace.nspname = 'public'
      AND proc.proname = 'handle_new_user'
      AND proc.pronargs = 0;

    SELECT count(*)
    INTO profile_writer_trigger_count
    FROM pg_trigger trigger_row
    JOIN pg_proc proc ON proc.oid = trigger_row.tgfoid
    WHERE trigger_row.tgrelid = 'auth.users'::regclass
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled <> 'D'
      AND pg_get_triggerdef(trigger_row.oid) ILIKE '%AFTER INSERT%'
      AND pg_get_functiondef(proc.oid) ~* 'INSERT\s+INTO\s+public\.profiles';

    IF bootstrap_oid IS NULL
       OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = bootstrap_oid)
       OR bootstrap_owner NOT IN ('postgres', 'supabase_admin')
       OR NOT (SELECT coalesce(proconfig, ARRAY[]::text[]) = ARRAY['search_path=""'] FROM pg_proc WHERE oid = bootstrap_oid)
       OR bootstrap_definition !~* 'INSERT\s+INTO\s+public\.profiles'
       OR bootstrap_definition !~* 'role[^;]*parent_id[^;]*franchise_id'
       OR bootstrap_definition !~* 'VALUES[^;]*NULL[^;]*NULL[^;]*NULL'
       OR bootstrap_definition ~* '''agent'''
       OR bootstrap_definition !~* 'ON\s+CONFLICT\s*\(id\)\s+DO\s+NOTHING'
       OR EXISTS (
           SELECT 1
           FROM pg_proc proc
           CROSS JOIN LATERAL aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
           WHERE proc.oid = bootstrap_oid
             AND acl.grantee = 0
             AND acl.privilege_type = 'EXECUTE'
       )
       OR has_function_privilege('anon', bootstrap_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', bootstrap_oid, 'EXECUTE')
       OR has_function_privilege('service_role', bootstrap_oid, 'EXECUTE')
       OR to_regrole('supabase_auth_admin') IS NULL
       OR NOT has_function_privilege('supabase_auth_admin', bootstrap_oid, 'EXECUTE')
       OR profile_writer_trigger_count <> 1
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger trigger_row
           WHERE trigger_row.tgrelid = 'auth.users'::regclass
             AND NOT trigger_row.tgisinternal
             AND trigger_row.tgenabled <> 'D'
             AND trigger_row.tgfoid = bootstrap_oid
             AND pg_get_triggerdef(trigger_row.oid) ILIKE '%AFTER INSERT%'
       ) THEN
        RAISE EXCEPTION 'EXPAND RED: neutral Auth bootstrap definition, ACL, or unique binding is unsafe';
    END IF;
END
$$;

ROLLBACK;
SELECT 'ok' AS profile_authority_expand_structure_verification;

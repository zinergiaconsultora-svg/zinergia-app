-- El cambio de autoridad acepta un colaborador sin franquicia.
--
-- La migración anterior relajó la regla de la tabla, pero el mando que ejecuta
-- el cambio seguía exigiendo franquicia para `agent` y rechazaba la operación
-- con AUTHORITY_TUPLE_INVALID. Relajar la regla y no el mando deja la
-- funcionalidad a medias: la base de datos lo permitiría, pero no hay forma de
-- pedirlo.
--
-- Sólo cambia el bloque de validación. Todo lo demás —idempotencia por
-- request_id, cerrojo global, detección de ciclos, protección del último
-- administrador, evento inmutable— se reproduce igual. Lo que se relaja:
--
--   * `agent` necesita responsable; la franquicia pasa a ser opcional.
--   * Si trae franquicia, se sigue exigiendo que exista y esté activa, y que el
--     responsable encaje con ella. No se admite una franquicia inventada.
--   * Si no trae franquicia, el responsable tiene que ser el administrador
--     canónico. Sin franquicia no hay otra jerarquía posible.
--
-- Lo que NO cambia: `franchise` sigue necesitando ambas, y el administrador
-- sigue sin ninguna de las dos.

BEGIN;

CREATE OR REPLACE FUNCTION public.change_profile_authority(
    p_actor_id uuid,
    p_target_id uuid,
    p_desired_role text,
    p_parent_id uuid,
    p_franchise_id uuid,
    p_expected_authority_version bigint,
    p_reason_code text,
    p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_actor public.profiles%ROWTYPE;
    v_target public.profiles%ROWTYPE;
    v_parent public.profiles%ROWTYPE;
    v_parent_admin public.profiles%ROWTYPE;
    v_franchise public.franchises%ROWTYPE;
    v_existing public.profile_authority_events%ROWTYPE;
    v_after_state jsonb;
    v_event_id uuid := gen_random_uuid();
    v_context jsonb;
BEGIN
    IF p_actor_id IS NULL OR p_target_id IS NULL OR p_request_id IS NULL
       OR p_expected_authority_version IS NULL OR p_reason_code IS NULL
       OR p_actor_id = p_target_id
       OR p_reason_code NOT IN (
           'role_change', 'franchise_assignment', 'franchise_removal', 'deactivation',
           'reactivation', 'invitation_acceptance', 'authority_correction', 'security_recovery'
       )
       OR (p_desired_role IS NOT NULL AND p_desired_role NOT IN ('admin', 'franchise', 'agent')) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_INPUT_INVALID';
    END IF;

    v_after_state := private.profile_authority_state(p_desired_role, p_parent_id, p_franchise_id);
    SELECT * INTO v_existing
    FROM public.profile_authority_events
    WHERE request_id = p_request_id;
    IF FOUND THEN
        IF v_existing.actor_id IS DISTINCT FROM p_actor_id
           OR v_existing.target_profile_id IS DISTINCT FROM p_target_id
           OR v_existing.reason_code IS DISTINCT FROM p_reason_code
           OR v_existing.event_type IS DISTINCT FROM 'authority_changed'
           OR v_existing.before_version IS DISTINCT FROM p_expected_authority_version
           OR v_existing.after_state IS DISTINCT FROM v_after_state
           OR v_existing.source_type IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_ID_CONFLICT';
        END IF;
    END IF;

    -- One global transaction lock serializes last-Admin and hierarchy-cycle decisions.
    PERFORM pg_advisory_xact_lock(hashtextextended('profile-authority-canonical', 0));
    IF EXISTS (
        SELECT 1
        FROM public.profile_invitation_provisioning p
        WHERE p.request_id = p_request_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_ID_CONFLICT';
    END IF;
    SELECT * INTO v_existing
    FROM public.profile_authority_events
    WHERE request_id = p_request_id;
    IF FOUND THEN
        IF v_existing.actor_id IS DISTINCT FROM p_actor_id
           OR v_existing.target_profile_id IS DISTINCT FROM p_target_id
           OR v_existing.reason_code IS DISTINCT FROM p_reason_code
           OR v_existing.event_type IS DISTINCT FROM 'authority_changed'
           OR v_existing.before_version IS DISTINCT FROM p_expected_authority_version
           OR v_existing.after_state IS DISTINCT FROM v_after_state
           OR v_existing.source_type IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_ID_CONFLICT';
        END IF;
        RETURN jsonb_build_object('event_id', v_existing.id);
    END IF;

    PERFORM 1 FROM public.profiles
    WHERE id IN (p_actor_id, p_target_id)
    ORDER BY id
    FOR UPDATE;
    SELECT * INTO v_actor FROM public.profiles WHERE id = p_actor_id;
    SELECT * INTO v_target FROM public.profiles WHERE id = p_target_id;

    IF v_actor.id IS NULL OR v_actor.role IS DISTINCT FROM 'admin'
       OR v_actor.parent_id IS NOT NULL OR v_actor.franchise_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTOR_NOT_ADMIN';
    END IF;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TARGET_NOT_FOUND';
    END IF;
    IF v_target.authority_version <> p_expected_authority_version THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STALE_AUTHORITY_VERSION';
    END IF;

    IF p_desired_role IS NULL AND p_parent_id IS NULL AND p_franchise_id IS NULL THEN
        NULL;
    ELSIF p_desired_role = 'admin' AND p_parent_id IS NULL AND p_franchise_id IS NULL THEN
        NULL;
    ELSIF p_desired_role IN ('agent', 'franchise') THEN
        -- El responsable sigue siendo obligatorio para los dos. La franquicia, sólo
        -- para el rol de franquicia: es lo único que se relaja aquí.
        IF p_parent_id IS NULL OR p_parent_id = p_target_id THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_TUPLE_INVALID';
        END IF;
        IF p_desired_role = 'franchise' AND p_franchise_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_TUPLE_INVALID';
        END IF;

        -- Una franquicia indicada tiene que existir y estar activa, se pida para
        -- el rol que se pida. Aceptar una inventada abriría la puerta a colgar a
        -- alguien de una estructura que no existe.
        IF p_franchise_id IS NOT NULL THEN
            SELECT * INTO v_franchise
            FROM public.franchises f
            WHERE f.id = p_franchise_id
            FOR UPDATE;
            IF v_franchise.id IS NULL OR v_franchise.is_active IS NOT TRUE THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_TUPLE_INVALID';
            END IF;
        END IF;

        SELECT * INTO v_parent
        FROM public.profiles
        WHERE id = p_parent_id
        FOR UPDATE;
        IF v_parent.id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_PARENT_INVALID';
        END IF;

        IF p_desired_role = 'franchise' THEN
            IF v_parent.role IS DISTINCT FROM 'admin'
               OR v_parent.parent_id IS NOT NULL OR v_parent.franchise_id IS NOT NULL THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_PARENT_INVALID';
            END IF;
        ELSIF v_parent.role IS NOT DISTINCT FROM 'admin'
              AND v_parent.parent_id IS NULL AND v_parent.franchise_id IS NULL THEN
            -- Colgar del administrador vale siempre, con franquicia o sin ella. Es
            -- el caso normal del modelo nuevo.
            NULL;
        ELSIF p_franchise_id IS NOT NULL
              AND v_parent.role IS NOT DISTINCT FROM 'franchise'
              AND v_parent.parent_id IS NOT NULL
              AND v_parent.franchise_id = p_franchise_id THEN
            SELECT * INTO v_parent_admin
            FROM public.profiles
            WHERE id = v_parent.parent_id
            FOR UPDATE;
            IF v_parent_admin.id IS NULL
               OR v_parent_admin.role IS DISTINCT FROM 'admin'
               OR v_parent_admin.parent_id IS NOT NULL
               OR v_parent_admin.franchise_id IS NOT NULL THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_PARENT_INVALID';
            END IF;
        ELSE
            -- Sin franquicia, el único responsable posible es el administrador:
            -- colgar de una franquicia sin pertenecer a ella no significa nada.
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_PARENT_INVALID';
        END IF;

        IF EXISTS (
            WITH RECURSIVE ancestors AS (
                SELECT p.id, p.parent_id, ARRAY[p.id]::uuid[] AS path
                FROM public.profiles p
                WHERE p.id = p_parent_id
                UNION ALL
                SELECT p.id, p.parent_id, a.path || p.id
                FROM public.profiles p
                JOIN ancestors a ON p.id = a.parent_id
                WHERE NOT p.id = ANY(a.path)
            )
            SELECT 1 FROM ancestors WHERE id = p_target_id
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_CYCLE';
        END IF;
    ELSE
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_TUPLE_INVALID';
    END IF;

    IF v_target.role = 'admin' AND p_desired_role IS DISTINCT FROM 'admin' THEN
        PERFORM 1 FROM public.profiles
        WHERE role = 'admin' AND parent_id IS NULL AND franchise_id IS NULL
        ORDER BY id
        FOR UPDATE;
        IF (SELECT count(*) FROM public.profiles
            WHERE role = 'admin' AND parent_id IS NULL AND franchise_id IS NULL) <= 1 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LAST_ADMIN';
        END IF;
    END IF;

    v_context := jsonb_build_object(
        'event_id', v_event_id,
        'actor_id', p_actor_id,
        'target_profile_id', p_target_id,
        'event_type', 'authority_changed',
        'reason_code', p_reason_code,
        'request_id', p_request_id,
        'before_version', v_target.authority_version,
        'after_version', v_target.authority_version + 1,
        'before_state', private.profile_authority_state(v_target.role, v_target.parent_id, v_target.franchise_id),
        'after_state', v_after_state,
        'source_type', NULL,
        'source_id', NULL
    );

    PERFORM set_config('app.profile_authority_context', v_context::text, true);
    UPDATE public.profiles AS profile
    SET role = p_desired_role,
        parent_id = p_parent_id,
        franchise_id = p_franchise_id,
        authority_version = authority_version + 1
    WHERE id = p_target_id;
    PERFORM set_config('app.profile_authority_context', '', true);

    RETURN jsonb_build_object('event_id', v_event_id);
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.profile_authority_context', '', true);
    RAISE;
END;
$$;

COMMIT;

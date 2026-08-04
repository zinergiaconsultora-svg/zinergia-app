-- ZIN-SDD-043 slice 2: protected capture and revocation of SIPS consent.
--
-- Slice 1 made the read path require a consent. Nothing could create one from the
-- application, so the route denied every request. This migration adds the write path, and
-- closes the browser write door at the same time.
--
-- Today `sips_consents` carries a single `FOR ALL TO authenticated USING (user_id =
-- auth.uid())` policy plus table privileges, so a browser holding an anon key can insert a
-- consent for any CUPS, with any source and any timestamp, and can also edit or delete its
-- own history. That defeats the point of the record: consent evidence is only worth
-- anything if it cannot be authored or rewritten from the client (REQ-006, INV-007,
-- INV-010).
--
-- After this migration every write goes through the two SECURITY DEFINER commands below.

BEGIN;

-- Shared scope predicate, so capture, revocation and the read gate cannot drift apart.
CREATE OR REPLACE FUNCTION private.can_reach_sips_client(
    p_actor public.profiles,
    p_client_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.clients AS client
        WHERE client.id = p_client_id
          AND (
              p_actor.role = 'admin'
              OR (p_actor.role = 'franchise'
                  AND p_actor.franchise_id IS NOT NULL
                  AND client.franchise_id = p_actor.franchise_id)
              OR (p_actor.role = 'agent' AND client.owner_id = p_actor.id)
          )
    );
$$;

REVOKE ALL ON FUNCTION private.can_reach_sips_client(public.profiles, uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_reach_sips_client(public.profiles, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.record_sips_consent(
    p_cups_hash text,
    p_client_id uuid DEFAULT NULL,
    p_consent_source text DEFAULT 'agent_confirmation',
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor public.profiles%ROWTYPE;
    v_existing public.sips_consents%ROWTYPE;
    v_id uuid;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSENT_NOT_AUTHORIZED';
    END IF;

    -- Blind index from hashCups(): HMAC-SHA-256 as lowercase hex. The raw CUPS never
    -- reaches this function.
    IF p_cups_hash IS NULL OR p_cups_hash !~ '^[0-9a-f]{64,128}$' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSENT_INPUT_INVALID';
    END IF;

    IF p_consent_source IS NULL OR p_consent_source NOT IN (
        'agent_confirmation', 'verbal_visit', 'signed_document', 'email'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSENT_SOURCE_INVALID';
    END IF;

    -- Free-text notes are operator input; cap them so the evidence trail cannot be used as
    -- unbounded storage.
    IF p_notes IS NOT NULL AND length(p_notes) > 500 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSENT_INPUT_INVALID';
    END IF;

    SELECT * INTO v_actor FROM public.profiles WHERE id = v_actor_id;
    IF NOT FOUND OR v_actor.role IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSENT_NOT_AUTHORIZED';
    END IF;

    IF p_client_id IS NOT NULL AND NOT private.can_reach_sips_client(v_actor, p_client_id) THEN
        -- Same opaque error as an unauthenticated attempt: a caller must not be able to
        -- probe which client ids exist.
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSENT_NOT_AUTHORIZED';
    END IF;

    -- Idempotent: one effective active consent per (supply, client, capturing actor).
    -- Repeating the capture returns the original fact rather than stacking duplicates.
    SELECT * INTO v_existing
    FROM public.sips_consents
    WHERE cups_hash = p_cups_hash
      AND user_id = v_actor_id
      AND client_id IS NOT DISTINCT FROM p_client_id
      AND revoked_at IS NULL
    ORDER BY consent_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object('consent_id', v_existing.id, 'created', false);
    END IF;

    INSERT INTO public.sips_consents (user_id, client_id, cups_hash, consent_source, notes)
    VALUES (v_actor_id, p_client_id, p_cups_hash, p_consent_source, nullif(btrim(p_notes), ''))
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('consent_id', v_id, 'created', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_sips_consent(p_consent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor public.profiles%ROWTYPE;
    v_consent public.sips_consents%ROWTYPE;
BEGIN
    IF v_actor_id IS NULL OR p_consent_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSENT_NOT_AUTHORIZED';
    END IF;

    SELECT * INTO v_actor FROM public.profiles WHERE id = v_actor_id;
    IF NOT FOUND OR v_actor.role IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSENT_NOT_AUTHORIZED';
    END IF;

    SELECT * INTO v_consent
    FROM public.sips_consents
    WHERE id = p_consent_id
    FOR UPDATE;

    IF NOT FOUND
       OR NOT (
           v_consent.user_id = v_actor_id
           OR (v_consent.client_id IS NOT NULL
               AND private.can_reach_sips_client(v_actor, v_consent.client_id))
       ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSENT_NOT_AUTHORIZED';
    END IF;

    -- Revocation is a one-way state change. History is never edited: re-authorising later
    -- creates a new consent row, which is a new auditable fact (INV-010).
    IF v_consent.revoked_at IS NOT NULL THEN
        RETURN jsonb_build_object('consent_id', v_consent.id, 'revoked', true, 'already_revoked', true);
    END IF;

    UPDATE public.sips_consents
    SET revoked_at = now()
    WHERE id = p_consent_id AND revoked_at IS NULL;

    RETURN jsonb_build_object('consent_id', p_consent_id, 'revoked', true, 'already_revoked', false);
END;
$$;

-- Status for the capture UI. Returns the consent fact within scope, never consumption data.
CREATE OR REPLACE FUNCTION public.get_sips_consent_status(
    p_cups_hash text,
    p_client_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor public.profiles%ROWTYPE;
    v_consent public.sips_consents%ROWTYPE;
BEGIN
    IF v_actor_id IS NULL OR p_cups_hash IS NULL OR p_cups_hash !~ '^[0-9a-f]{64,128}$' THEN
        RETURN jsonb_build_object('has_active_consent', false);
    END IF;

    SELECT * INTO v_actor FROM public.profiles WHERE id = v_actor_id;
    IF NOT FOUND OR v_actor.role IS NULL THEN
        RETURN jsonb_build_object('has_active_consent', false);
    END IF;

    IF p_client_id IS NOT NULL AND NOT private.can_reach_sips_client(v_actor, p_client_id) THEN
        RETURN jsonb_build_object('has_active_consent', false);
    END IF;

    SELECT * INTO v_consent
    FROM public.sips_consents
    WHERE cups_hash = p_cups_hash
      AND revoked_at IS NULL
      AND (
          user_id = v_actor_id
          OR (client_id IS NOT NULL AND private.can_reach_sips_client(v_actor, client_id))
      )
    ORDER BY consent_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('has_active_consent', false);
    END IF;

    RETURN jsonb_build_object(
        'has_active_consent', true,
        'consent_id', v_consent.id,
        'consent_at', v_consent.consent_at,
        'consent_source', v_consent.consent_source,
        'captured_by_me', v_consent.user_id = v_actor_id
    );
END;
$$;

-- Close the browser write path. Reads of one's own rows stay available for support and
-- export; every mutation now goes through the commands above.
DROP POLICY IF EXISTS "Users can manage own SIPS consents" ON public.sips_consents;
DROP POLICY IF EXISTS sips_consents_select_own ON public.sips_consents;

CREATE POLICY sips_consents_select_own
    ON public.sips_consents FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.sips_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.sips_consents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sips_consents TO service_role;

REVOKE ALL ON FUNCTION public.record_sips_consent(text, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_sips_consent(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sips_consent_status(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sips_consent(text, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_sips_consent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sips_consent_status(text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.record_sips_consent(text, uuid, text, text) IS
    'ZIN-SDD-043: captures one SIPS consent bound to actor, source and time. Idempotent per (supply, client, actor). Raises one opaque error for every authorization failure.';
COMMENT ON FUNCTION public.revoke_sips_consent(uuid) IS
    'ZIN-SDD-043: revokes a reachable consent. Idempotent, one-way; re-authorising creates a new row.';
COMMENT ON TABLE public.sips_consents IS
    'ZIN-SDD-043: append-only consent evidence. Browser writes are revoked; use record_sips_consent/revoke_sips_consent.';

COMMIT;

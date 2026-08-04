-- Governed client portfolio ownership (carterizacion).
--
-- `clients.owner_id` already decides who the client belongs to, and it feeds commission
-- attribution. What was missing is governance: any writer with table access could move a
-- client between agents, silently, with no evidence of who did it or why. In a network with
-- franchises and agents that is the classic source of "this client is mine" disputes, and
-- every one of them is also a commission dispute.
--
-- This migration reuses the shape ZIN-SDD-041 established for profile authority, because
-- the problem is the same one: a small, contested, money-adjacent field that needs an
-- optimistic version, a purpose-specific command and immutable evidence.
--
-- Deliberately NOT in this slice: the request/approval workflow for an agent asking for a
-- transfer. Admin and franchise can transfer directly; an agent cannot. Adding a request
-- state machine on top of this is additive and does not change anything below.

BEGIN;

ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS ownership_version bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.client_ownership_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    actor_id uuid NOT NULL,
    from_owner_id uuid NOT NULL,
    to_owner_id uuid NOT NULL,
    from_franchise_id uuid,
    to_franchise_id uuid,
    reason_code text NOT NULL,
    notes text,
    request_id uuid NOT NULL,
    before_version bigint NOT NULL,
    after_version bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT client_ownership_events_request_id_key UNIQUE (request_id),
    CONSTRAINT client_ownership_events_reason_check CHECK (
        reason_code IN (
            'initial_assignment',
            'agent_reassignment',
            'agent_departure',
            'franchise_reassignment',
            'dispute_resolution',
            'data_correction'
        )
    ),
    CONSTRAINT client_ownership_events_version_check CHECK (
        before_version >= 0 AND after_version = before_version + 1
    ),
    CONSTRAINT client_ownership_events_moves_owner_check CHECK (from_owner_id <> to_owner_id),
    CONSTRAINT client_ownership_events_notes_check CHECK (notes IS NULL OR length(notes) <= 500)
);

CREATE INDEX IF NOT EXISTS client_ownership_events_client_created_idx
    ON public.client_ownership_events (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS client_ownership_events_actor_created_idx
    ON public.client_ownership_events (actor_id, created_at DESC);

ALTER TABLE public.client_ownership_events ENABLE ROW LEVEL SECURITY;

-- Evidence is append-only. A transfer that can be edited afterwards proves nothing.
CREATE OR REPLACE FUNCTION private.prevent_client_ownership_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_EVENT_IMMUTABLE';
END;
$$;

DROP TRIGGER IF EXISTS client_ownership_events_reject_update_delete ON public.client_ownership_events;
CREATE TRIGGER client_ownership_events_reject_update_delete
    BEFORE UPDATE OR DELETE ON public.client_ownership_events
    FOR EACH ROW EXECUTE FUNCTION private.prevent_client_ownership_event_mutation();

DROP TRIGGER IF EXISTS client_ownership_events_reject_truncate ON public.client_ownership_events;
CREATE TRIGGER client_ownership_events_reject_truncate
    BEFORE TRUNCATE ON public.client_ownership_events
    FOR EACH STATEMENT EXECUTE FUNCTION private.prevent_client_ownership_event_mutation();

-- Guard: ownership only moves through the command below, which sets the context. This
-- applies to service_role too - triggers are not bypassed by role.
CREATE OR REPLACE FUNCTION private.client_ownership_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_context_text text;
    v_context jsonb;
BEGIN
    IF ROW(NEW.owner_id, NEW.franchise_id, NEW.ownership_version)
       IS NOT DISTINCT FROM
       ROW(OLD.owner_id, OLD.franchise_id, OLD.ownership_version) THEN
        RETURN NEW;
    END IF;

    -- Bumping the version without moving the client is meaningless and would let a writer
    -- invalidate somebody else's optimistic read.
    IF ROW(NEW.owner_id, NEW.franchise_id)
       IS NOT DISTINCT FROM
       ROW(OLD.owner_id, OLD.franchise_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_VERSION_PROTECTED';
    END IF;

    v_context_text := current_setting('app.client_ownership_context', true);
    IF v_context_text IS NULL OR v_context_text = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_CONTEXT_REQUIRED';
    END IF;

    BEGIN
        v_context := v_context_text::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_CONTEXT_INVALID';
    END;

    IF (v_context->>'client_id')::uuid IS DISTINCT FROM OLD.id
       OR (v_context->>'before_version')::bigint IS DISTINCT FROM OLD.ownership_version
       OR (v_context->>'from_owner_id')::uuid IS DISTINCT FROM OLD.owner_id
       OR (v_context->>'to_owner_id')::uuid IS DISTINCT FROM NEW.owner_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_CONTEXT_MISMATCH';
    END IF;

    NEW.ownership_version := OLD.ownership_version + 1;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_ownership_guard ON public.clients;
CREATE TRIGGER clients_ownership_guard
    BEFORE UPDATE OF owner_id, franchise_id, ownership_version
    ON public.clients
    FOR EACH ROW EXECUTE FUNCTION private.client_ownership_guard();

CREATE OR REPLACE FUNCTION public.transfer_client_ownership(
    p_client_id uuid,
    p_to_owner_id uuid,
    p_expected_ownership_version bigint,
    p_reason_code text,
    p_request_id uuid,
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
    v_target public.profiles%ROWTYPE;
    v_client public.clients%ROWTYPE;
    v_existing public.client_ownership_events%ROWTYPE;
    v_event_id uuid := gen_random_uuid();
    v_to_franchise_id uuid;
    v_context jsonb;
BEGIN
    IF v_actor_id IS NULL OR p_client_id IS NULL OR p_to_owner_id IS NULL
       OR p_request_id IS NULL OR p_expected_ownership_version IS NULL
       OR p_reason_code IS NULL
       OR p_reason_code NOT IN (
           'initial_assignment', 'agent_reassignment', 'agent_departure',
           'franchise_reassignment', 'dispute_resolution', 'data_correction'
       )
       OR (p_notes IS NOT NULL AND length(p_notes) > 500) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_INPUT_INVALID';
    END IF;

    -- Serialises concurrent transfers of the same client so two reviewers cannot both
    -- consume the same expected version.
    PERFORM pg_advisory_xact_lock(hashtextextended('client-portfolio-ownership', 0));

    -- Replay of the same request returns the stored event; reuse of a request id with
    -- different intent is a conflict, not a silent second transfer.
    SELECT * INTO v_existing
    FROM public.client_ownership_events
    WHERE request_id = p_request_id;
    IF FOUND THEN
        IF v_existing.client_id IS DISTINCT FROM p_client_id
           OR v_existing.actor_id IS DISTINCT FROM v_actor_id
           OR v_existing.to_owner_id IS DISTINCT FROM p_to_owner_id
           OR v_existing.before_version IS DISTINCT FROM p_expected_ownership_version THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_REQUEST_CONFLICT';
        END IF;
        RETURN jsonb_build_object('event_id', v_existing.id, 'applied', false);
    END IF;

    SELECT * INTO v_actor FROM public.profiles WHERE id = v_actor_id;
    IF NOT FOUND OR v_actor.role IS NULL OR v_actor.role NOT IN ('admin', 'franchise') THEN
        -- Agents cannot move their own clients: that is precisely the dispute this guards.
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_NOT_AUTHORIZED';
    END IF;

    SELECT * INTO v_client FROM public.clients WHERE id = p_client_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_NOT_AUTHORIZED';
    END IF;
    IF v_client.ownership_version <> p_expected_ownership_version THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_STALE_VERSION';
    END IF;
    IF v_client.owner_id = p_to_owner_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_UNCHANGED';
    END IF;

    SELECT * INTO v_target FROM public.profiles WHERE id = p_to_owner_id;
    IF NOT FOUND OR v_target.role IS NULL OR v_target.role NOT IN ('agent', 'franchise') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_TARGET_INVALID';
    END IF;

    IF v_actor.role = 'franchise' THEN
        -- A franchise moves clients inside its own network only, and only to members of it.
        IF v_actor.franchise_id IS NULL
           OR v_client.franchise_id IS DISTINCT FROM v_actor.franchise_id
           OR v_target.franchise_id IS DISTINCT FROM v_actor.franchise_id THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_NOT_AUTHORIZED';
        END IF;
        v_to_franchise_id := v_client.franchise_id;
    ELSE
        -- Admin may move a client across franchises; the client follows the new owner so a
        -- client can never sit in a franchise its owner does not belong to.
        v_to_franchise_id := v_target.franchise_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.franchises f
        WHERE f.id = v_to_franchise_id AND f.is_active IS TRUE
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_TARGET_INVALID';
    END IF;

    v_context := jsonb_build_object(
        'client_id', p_client_id,
        'before_version', v_client.ownership_version,
        'from_owner_id', v_client.owner_id,
        'to_owner_id', p_to_owner_id
    );

    PERFORM set_config('app.client_ownership_context', v_context::text, true);
    UPDATE public.clients
    SET owner_id = p_to_owner_id,
        franchise_id = v_to_franchise_id,
        ownership_version = ownership_version + 1
    WHERE id = p_client_id;
    PERFORM set_config('app.client_ownership_context', '', true);

    INSERT INTO public.client_ownership_events (
        id, client_id, actor_id, from_owner_id, to_owner_id,
        from_franchise_id, to_franchise_id, reason_code, notes,
        request_id, before_version, after_version
    ) VALUES (
        v_event_id, p_client_id, v_actor_id, v_client.owner_id, p_to_owner_id,
        v_client.franchise_id, v_to_franchise_id, p_reason_code, nullif(btrim(p_notes), ''),
        p_request_id, v_client.ownership_version, v_client.ownership_version + 1
    );

    RETURN jsonb_build_object('event_id', v_event_id, 'applied', true);
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.client_ownership_context', '', true);
    RAISE;
END;
$$;

-- Reads: the network sees the history of clients it can already reach.
DROP POLICY IF EXISTS client_ownership_events_scoped_select ON public.client_ownership_events;
CREATE POLICY client_ownership_events_scoped_select
    ON public.client_ownership_events FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.clients AS client
        WHERE client.id = client_ownership_events.client_id
    ));

REVOKE ALL ON TABLE public.client_ownership_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.client_ownership_events TO authenticated;
GRANT SELECT, INSERT ON TABLE public.client_ownership_events TO service_role;

REVOKE ALL ON FUNCTION private.prevent_client_ownership_event_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.client_ownership_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.transfer_client_ownership(uuid, uuid, bigint, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_client_ownership(uuid, uuid, bigint, text, uuid, text) TO authenticated, service_role;

COMMENT ON TABLE public.client_ownership_events IS
    'Immutable carterizacion evidence: who moved which client, from whom to whom, why and when.';
COMMENT ON COLUMN public.clients.ownership_version IS
    'Optimistic concurrency token for portfolio ownership. Only transfer_client_ownership may advance it.';
COMMENT ON FUNCTION public.transfer_client_ownership(uuid, uuid, bigint, text, uuid, text) IS
    'Governed portfolio transfer. Admin moves across franchises, franchise moves inside its own network, agents cannot move clients. Idempotent per request_id.';

COMMIT;

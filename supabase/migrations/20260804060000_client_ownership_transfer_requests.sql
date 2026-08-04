-- Carterizacion, slice 2: request and approval for portfolio transfers.
--
-- Slice 1 deliberately left agents unable to move their own clients, because self-service
-- reassignment is the dispute this whole area guards against. That left a real gap: an
-- agent who legitimately needs a client moved - handover, departure, a client that was
-- assigned to the wrong person - had no path at all, so the work would go back to being
-- settled over WhatsApp and applied by whoever had database access.
--
-- This adds the missing path without weakening the rule: the agent asks, a franchise or
-- admin decides, and the approval performs the same governed transfer as before. The
-- decision itself is the authorization; there is no separate privilege.

BEGIN;

CREATE TABLE IF NOT EXISTS public.client_ownership_transfer_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    requested_by uuid NOT NULL,
    from_owner_id uuid NOT NULL,
    to_owner_id uuid NOT NULL,
    reason_code text NOT NULL,
    notes text,
    status text NOT NULL DEFAULT 'pending',
    decided_by uuid,
    decided_at timestamptz,
    decision_notes text,
    ownership_event_id uuid REFERENCES public.client_ownership_events(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT client_ownership_transfer_requests_reason_check CHECK (
        reason_code IN (
            'agent_reassignment',
            'agent_departure',
            'dispute_resolution',
            'data_correction'
        )
    ),
    CONSTRAINT client_ownership_transfer_requests_status_check CHECK (
        status IN ('pending', 'approved', 'rejected', 'cancelled')
    ),
    CONSTRAINT client_ownership_transfer_requests_moves_owner_check CHECK (from_owner_id <> to_owner_id),
    CONSTRAINT client_ownership_transfer_requests_notes_check CHECK (
        (notes IS NULL OR length(notes) <= 500)
        AND (decision_notes IS NULL OR length(decision_notes) <= 500)
    ),
    -- A decided request must carry who decided it and when; a pending one must not.
    CONSTRAINT client_ownership_transfer_requests_decision_shape_check CHECK (
        (status = 'pending' AND decided_by IS NULL AND decided_at IS NULL AND ownership_event_id IS NULL)
        OR (status = 'approved' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND ownership_event_id IS NOT NULL)
        OR (status IN ('rejected', 'cancelled') AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND ownership_event_id IS NULL)
    )
);

-- At most one open request per client, so two agents cannot both have a live claim.
CREATE UNIQUE INDEX IF NOT EXISTS client_ownership_transfer_requests_one_pending_idx
    ON public.client_ownership_transfer_requests (client_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS client_ownership_transfer_requests_requester_idx
    ON public.client_ownership_transfer_requests (requested_by, created_at DESC);

ALTER TABLE public.client_ownership_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.request_client_ownership_transfer(
    p_client_id uuid,
    p_to_owner_id uuid,
    p_reason_code text,
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
    v_existing public.client_ownership_transfer_requests%ROWTYPE;
    v_id uuid := gen_random_uuid();
BEGIN
    IF v_actor_id IS NULL OR p_client_id IS NULL OR p_to_owner_id IS NULL
       OR p_reason_code IS NULL
       OR p_reason_code NOT IN ('agent_reassignment', 'agent_departure', 'dispute_resolution', 'data_correction')
       OR (p_notes IS NOT NULL AND length(p_notes) > 500) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_REQUEST_INPUT_INVALID';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('client-portfolio-ownership', 0));

    SELECT * INTO v_actor FROM public.profiles WHERE id = v_actor_id;
    IF NOT FOUND OR v_actor.role IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_REQUEST_NOT_AUTHORIZED';
    END IF;

    SELECT * INTO v_client FROM public.clients WHERE id = p_client_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_REQUEST_NOT_AUTHORIZED';
    END IF;

    -- Only the current owner may ask for their own client to be moved. A request from
    -- anyone else would be a claim over somebody else's portfolio, which is a different
    -- (and more contentious) flow than this one.
    IF v_client.owner_id IS DISTINCT FROM v_actor_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_REQUEST_NOT_AUTHORIZED';
    END IF;
    IF v_client.owner_id = p_to_owner_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_REQUEST_UNCHANGED';
    END IF;

    SELECT * INTO v_target FROM public.profiles WHERE id = p_to_owner_id;
    IF NOT FOUND OR v_target.role IS NULL OR v_target.role NOT IN ('agent', 'franchise')
       OR v_target.franchise_id IS DISTINCT FROM v_client.franchise_id THEN
        -- Cross-franchise moves stay an admin decision; an agent cannot originate one.
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_REQUEST_TARGET_INVALID';
    END IF;

    SELECT * INTO v_existing
    FROM public.client_ownership_transfer_requests
    WHERE client_id = p_client_id AND status = 'pending';
    IF FOUND THEN
        -- Idempotent when it is the same ask; a competing one is a conflict, not a queue.
        IF v_existing.requested_by = v_actor_id AND v_existing.to_owner_id = p_to_owner_id THEN
            RETURN jsonb_build_object('request_id', v_existing.id, 'created', false);
        END IF;
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_REQUEST_ALREADY_PENDING';
    END IF;

    INSERT INTO public.client_ownership_transfer_requests (
        id, client_id, requested_by, from_owner_id, to_owner_id, reason_code, notes
    ) VALUES (
        v_id, p_client_id, v_actor_id, v_client.owner_id, p_to_owner_id,
        p_reason_code, nullif(btrim(p_notes), '')
    );

    RETURN jsonb_build_object('request_id', v_id, 'created', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_client_ownership_transfer(
    p_request_id uuid,
    p_approve boolean,
    p_decision_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor public.profiles%ROWTYPE;
    v_request public.client_ownership_transfer_requests%ROWTYPE;
    v_client public.clients%ROWTYPE;
    v_transfer jsonb;
    v_event_id uuid;
BEGIN
    IF v_actor_id IS NULL OR p_request_id IS NULL OR p_approve IS NULL
       OR (p_decision_notes IS NOT NULL AND length(p_decision_notes) > 500) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_INPUT_INVALID';
    END IF;

    SELECT * INTO v_actor FROM public.profiles WHERE id = v_actor_id;
    IF NOT FOUND OR v_actor.role IS NULL OR v_actor.role NOT IN ('admin', 'franchise') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_NOT_AUTHORIZED';
    END IF;

    SELECT * INTO v_request
    FROM public.client_ownership_transfer_requests
    WHERE id = p_request_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_NOT_AUTHORIZED';
    END IF;
    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_ALREADY_DECIDED';
    END IF;

    SELECT * INTO v_client FROM public.clients WHERE id = v_request.client_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_NOT_AUTHORIZED';
    END IF;

    IF v_actor.role = 'franchise'
       AND (v_actor.franchise_id IS NULL OR v_client.franchise_id IS DISTINCT FROM v_actor.franchise_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_NOT_AUTHORIZED';
    END IF;

    -- The requester cannot approve their own request, even if they later gained the role.
    IF v_request.requested_by = v_actor_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_SELF_APPROVAL';
    END IF;

    IF NOT p_approve THEN
        UPDATE public.client_ownership_transfer_requests
        SET status = 'rejected',
            decided_by = v_actor_id,
            decided_at = now(),
            decision_notes = nullif(btrim(p_decision_notes), '')
        WHERE id = p_request_id;
        RETURN jsonb_build_object('request_id', p_request_id, 'status', 'rejected');
    END IF;

    -- Ownership may have moved between the request and the decision. Approving a stale
    -- request would silently transfer a client the requester no longer owns.
    IF v_client.owner_id IS DISTINCT FROM v_request.from_owner_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_STALE';
    END IF;

    -- The approver is the actor of the transfer, so the existing command re-checks scope
    -- under their own role. No privilege is added by going through a request.
    v_transfer := public.transfer_client_ownership(
        v_request.client_id,
        v_request.to_owner_id,
        v_client.ownership_version,
        v_request.reason_code,
        v_request.id,
        v_request.notes
    );
    v_event_id := (v_transfer->>'event_id')::uuid;

    UPDATE public.client_ownership_transfer_requests
    SET status = 'approved',
        decided_by = v_actor_id,
        decided_at = now(),
        decision_notes = nullif(btrim(p_decision_notes), ''),
        ownership_event_id = v_event_id
    WHERE id = p_request_id;

    RETURN jsonb_build_object('request_id', p_request_id, 'status', 'approved', 'event_id', v_event_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_client_ownership_transfer(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_request public.client_ownership_transfer_requests%ROWTYPE;
BEGIN
    IF v_actor_id IS NULL OR p_request_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_NOT_AUTHORIZED';
    END IF;

    SELECT * INTO v_request
    FROM public.client_ownership_transfer_requests
    WHERE id = p_request_id
    FOR UPDATE;
    IF NOT FOUND OR v_request.requested_by IS DISTINCT FROM v_actor_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_NOT_AUTHORIZED';
    END IF;
    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSFER_DECISION_ALREADY_DECIDED';
    END IF;

    UPDATE public.client_ownership_transfer_requests
    SET status = 'cancelled',
        decided_by = v_actor_id,
        decided_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('request_id', p_request_id, 'status', 'cancelled');
END;
$$;

-- Reads follow the reader's client scope, same as the ownership history.
DROP POLICY IF EXISTS client_ownership_transfer_requests_scoped_select
    ON public.client_ownership_transfer_requests;
CREATE POLICY client_ownership_transfer_requests_scoped_select
    ON public.client_ownership_transfer_requests FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.clients AS client
        WHERE client.id = client_ownership_transfer_requests.client_id
    ));

REVOKE ALL ON TABLE public.client_ownership_transfer_requests
    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.client_ownership_transfer_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_ownership_transfer_requests TO service_role;

REVOKE ALL ON FUNCTION public.request_client_ownership_transfer(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_client_ownership_transfer(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_client_ownership_transfer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_client_ownership_transfer(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decide_client_ownership_transfer(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_client_ownership_transfer(uuid) TO authenticated, service_role;

COMMENT ON TABLE public.client_ownership_transfer_requests IS
    'Carterizacion requests. One pending request per client; approval performs the governed transfer with the approver as actor.';

COMMIT;

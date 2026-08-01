-- Keep proposal send and public acceptance aligned with the canonical opportunity.
-- Both functions are server-only and perform their durable writes in one transaction.

CREATE OR REPLACE FUNCTION public.send_crm_proposal(
    p_proposal_id uuid,
    p_actor_id uuid,
    p_public_token text,
    p_public_expires_at timestamptz
)
RETURNS TABLE (
    proposal_id uuid,
    opportunity_id uuid,
    owner_id uuid,
    outcome text,
    sent_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    proposal public.proposals%ROWTYPE;
    opportunity public.opportunities%ROWTYPE;
    actor_role text;
    actor_franchise_id uuid;
    transition_at timestamptz := clock_timestamp();
    result_outcome text := 'sent';
BEGIN
    IF p_public_token IS NULL
       OR p_public_token !~ '^[A-Za-z0-9_-]{32,64}$'
       OR p_public_expires_at IS NULL
       OR p_public_expires_at <= transition_at
    THEN
        RAISE EXCEPTION 'invalid proposal delivery details'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO proposal
    FROM public.proposals
    WHERE id = p_proposal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'proposal unavailable'
            USING ERRCODE = 'P0002';
    END IF;

    IF proposal.opportunity_id IS NULL AND proposal.ocr_job_id IS NOT NULL THEN
        SELECT job.opportunity_id, job.supply_point_id
        INTO proposal.opportunity_id, proposal.supply_point_id
        FROM public.ocr_jobs job
        WHERE job.id = proposal.ocr_job_id
          AND job.client_id = proposal.client_id;
    END IF;

    IF proposal.opportunity_id IS NULL THEN
        RAISE EXCEPTION 'proposal opportunity unavailable'
            USING ERRCODE = '23514';
    END IF;

    SELECT *
    INTO opportunity
    FROM public.opportunities
    WHERE id = proposal.opportunity_id
    FOR UPDATE;

    IF NOT FOUND
       OR proposal.client_id IS DISTINCT FROM opportunity.client_id
       OR proposal.agent_id IS DISTINCT FROM opportunity.owner_id
       OR proposal.franchise_id IS DISTINCT FROM opportunity.franchise_id
       OR (
            proposal.supply_point_id IS NOT NULL
            AND proposal.supply_point_id IS DISTINCT FROM opportunity.supply_point_id
       )
    THEN
        RAISE EXCEPTION 'proposal opportunity mismatch'
            USING ERRCODE = '23514';
    END IF;

    SELECT role, franchise_id
    INTO actor_role, actor_franchise_id
    FROM public.profiles
    WHERE id = p_actor_id;

    IF actor_role IS NULL OR NOT (
        actor_role = 'admin'
        OR opportunity.owner_id = p_actor_id
        OR (
            actor_role = 'franchise'
            AND actor_franchise_id IS NOT DISTINCT FROM opportunity.franchise_id
        )
    ) THEN
        RAISE EXCEPTION 'proposal actor unavailable'
            USING ERRCODE = '42501';
    END IF;

    IF proposal.status = 'sent' AND opportunity.stage = 'proposal_sent' THEN
        result_outcome := 'already_sent';
    ELSIF proposal.status = 'draft' AND opportunity.stage = 'proposal_preparation' THEN
        PERFORM public.transition_crm_opportunity(
            opportunity.id,
            'proposal_preparation',
            'proposal_sent',
            p_actor_id,
            'proposal_sent',
            '{"source":"proposal_delivery"}'::jsonb,
            transition_at + interval '3 days',
            NULL
        );
    ELSE
        RAISE EXCEPTION 'proposal cannot be sent from current state'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.proposals
    SET
        opportunity_id = opportunity.id,
        supply_point_id = opportunity.supply_point_id,
        status = 'sent',
        sent_date = COALESCE(sent_date, transition_at),
        public_token = p_public_token,
        public_expires_at = p_public_expires_at
    WHERE id = proposal.id;

    RETURN QUERY
    SELECT
        proposal.id,
        opportunity.id,
        opportunity.owner_id,
        result_outcome,
        COALESCE(proposal.sent_date, transition_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_crm_public_proposal(
    p_public_token text,
    p_signature_data text,
    p_signed_name text
)
RETURNS TABLE (
    proposal_id uuid,
    opportunity_id uuid,
    owner_id uuid,
    outcome text,
    accepted_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    proposal public.proposals%ROWTYPE;
    opportunity public.opportunities%ROWTYPE;
    transition_at timestamptz := clock_timestamp();
    result_outcome text := 'accepted_now';
BEGIN
    IF p_public_token IS NULL
       OR p_public_token !~ '^[A-Za-z0-9_-]{32,64}$'
       OR p_signed_name IS NULL
       OR length(btrim(p_signed_name)) NOT BETWEEN 2 AND 200
       OR p_signature_data IS NULL
       OR octet_length(p_signature_data) > 250000
       OR p_signature_data !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
    THEN
        RAISE EXCEPTION 'invalid public acceptance payload'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO proposal
    FROM public.proposals
    WHERE public_token = p_public_token
    FOR UPDATE;

    IF NOT FOUND OR proposal.opportunity_id IS NULL THEN
        RAISE EXCEPTION 'proposal unavailable'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO opportunity
    FROM public.opportunities
    WHERE id = proposal.opportunity_id
    FOR UPDATE;

    IF NOT FOUND
       OR proposal.client_id IS DISTINCT FROM opportunity.client_id
       OR proposal.supply_point_id IS DISTINCT FROM opportunity.supply_point_id
       OR proposal.agent_id IS DISTINCT FROM opportunity.owner_id
       OR proposal.franchise_id IS DISTINCT FROM opportunity.franchise_id
    THEN
        RAISE EXCEPTION 'proposal opportunity mismatch'
            USING ERRCODE = '23514';
    END IF;

    IF proposal.status = 'accepted' AND proposal.public_accepted_at IS NOT NULL THEN
        result_outcome := 'already_accepted';
        transition_at := proposal.public_accepted_at;

        IF opportunity.stage = 'proposal_sent' THEN
            UPDATE public.opportunities
            SET
                stage = 'accepted',
                stage_entered_at = transition_at,
                next_action_type = 'complete_activation',
                next_action_title = 'Completar alta',
                next_action_due_at = NULL
            WHERE id = opportunity.id;

            INSERT INTO public.opportunity_stage_history (
                opportunity_id,
                from_stage,
                to_stage,
                actor_id,
                reason_code,
                safe_metadata,
                created_at
            ) VALUES (
                opportunity.id,
                'proposal_sent',
                'accepted',
                NULL,
                'public_acceptance_reconciled',
                '{"source":"public_portal"}'::jsonb,
                transition_at
            );
        ELSIF opportunity.stage NOT IN ('accepted', 'activation', 'won') THEN
            RAISE EXCEPTION 'proposal opportunity state mismatch'
                USING ERRCODE = '23514';
        END IF;
    ELSE
        IF proposal.public_expires_at IS NULL
           OR proposal.public_expires_at <= transition_at
        THEN
            RAISE EXCEPTION 'proposal link expired'
                USING ERRCODE = 'P0001';
        END IF;

        IF proposal.status <> 'sent'
           OR proposal.public_accepted_at IS NOT NULL
           OR opportunity.stage <> 'proposal_sent'
        THEN
            RAISE EXCEPTION 'proposal unavailable'
                USING ERRCODE = 'P0002';
        END IF;

        UPDATE public.proposals
        SET
            status = 'accepted',
            pricing_status = 'locked',
            accepted_date = transition_at,
            public_accepted_at = transition_at,
            signed_at = transition_at,
            signature_data = p_signature_data,
            signed_name = btrim(p_signed_name)
        WHERE id = proposal.id;

        UPDATE public.opportunities
        SET
            stage = 'accepted',
            stage_entered_at = transition_at,
            next_action_type = 'complete_activation',
            next_action_title = 'Completar alta',
            next_action_due_at = NULL
        WHERE id = opportunity.id
          AND stage = 'proposal_sent';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'proposal opportunity state changed'
                USING ERRCODE = '40001';
        END IF;

        INSERT INTO public.opportunity_stage_history (
            opportunity_id,
            from_stage,
            to_stage,
            actor_id,
            reason_code,
            safe_metadata,
            created_at
        ) VALUES (
            opportunity.id,
            'proposal_sent',
            'accepted',
            NULL,
            'public_acceptance',
            '{"source":"public_portal"}'::jsonb,
            transition_at
        );
    END IF;

    RETURN QUERY
    SELECT
        proposal.id,
        opportunity.id,
        opportunity.owner_id,
        result_outcome,
        transition_at;
END;
$$;

REVOKE ALL ON FUNCTION public.send_crm_proposal(uuid, uuid, text, timestamptz)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_crm_proposal(uuid, uuid, text, timestamptz)
    TO service_role;

REVOKE ALL ON FUNCTION public.accept_crm_public_proposal(text, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_crm_public_proposal(text, text, text)
    TO service_role;

COMMENT ON FUNCTION public.send_crm_proposal(uuid, uuid, text, timestamptz)
IS 'Links and sends a proposal while atomically advancing its canonical opportunity. Server service role only.';

COMMENT ON FUNCTION public.accept_crm_public_proposal(text, text, text)
IS 'Idempotently accepts a signed public proposal while atomically advancing its canonical opportunity. Server service role only.';

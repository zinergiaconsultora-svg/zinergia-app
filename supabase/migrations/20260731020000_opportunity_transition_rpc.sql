-- Atomic opportunity transition used only by authorized server workflows.

CREATE OR REPLACE FUNCTION public.transition_crm_opportunity(
    p_opportunity_id uuid,
    p_expected_stage text,
    p_to_stage text,
    p_actor_id uuid,
    p_reason_code text DEFAULT NULL,
    p_safe_metadata jsonb DEFAULT '{}'::jsonb,
    p_next_action_due_at timestamptz DEFAULT NULL,
    p_loss_reason text DEFAULT NULL
)
RETURNS public.opportunities
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    current_opportunity public.opportunities%ROWTYPE;
    updated_opportunity public.opportunities%ROWTYPE;
    actor_role text;
    actor_franchise_id uuid;
    reopen_stage text;
    transition_allowed boolean := false;
    target_next_action_type text;
    target_next_action_title text;
    transition_at timestamptz := clock_timestamp();
BEGIN
    IF p_safe_metadata IS NULL OR jsonb_typeof(p_safe_metadata) <> 'object' THEN
        RAISE EXCEPTION 'safe metadata must be a JSON object'
            USING ERRCODE = '22023';
    END IF;

    IF octet_length(p_safe_metadata::text) > 2048 THEN
        RAISE EXCEPTION 'safe metadata is too large'
            USING ERRCODE = '22023';
    END IF;

    IF p_safe_metadata::text ~* '"(cups|dni|nif|cif|iban|email|phone|address|name|signature|token|public_token)"[[:space:]]*:'
    THEN
        RAISE EXCEPTION 'safe metadata contains a prohibited key'
            USING ERRCODE = '22023';
    END IF;

    IF p_reason_code IS NOT NULL
       AND p_reason_code !~ '^[a-z0-9_]{1,64}$'
    THEN
        RAISE EXCEPTION 'invalid reason code'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO current_opportunity
    FROM public.opportunities
    WHERE id = p_opportunity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'opportunity unavailable'
            USING ERRCODE = 'P0002';
    END IF;

    IF current_opportunity.stage <> p_expected_stage THEN
        RAISE EXCEPTION 'opportunity stage changed'
            USING ERRCODE = '40001';
    END IF;

    SELECT role, franchise_id
    INTO actor_role, actor_franchise_id
    FROM public.profiles
    WHERE id = p_actor_id;

    IF actor_role IS NULL THEN
        RAISE EXCEPTION 'opportunity actor unavailable'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (
        actor_role = 'admin'
        OR current_opportunity.owner_id = p_actor_id
        OR (
            actor_role = 'franchise'
            AND actor_franchise_id IS NOT DISTINCT FROM current_opportunity.franchise_id
        )
    ) THEN
        RAISE EXCEPTION 'opportunity actor is outside the portfolio'
            USING ERRCODE = '42501';
    END IF;

    IF p_to_stage = 'won' AND actor_role <> 'admin' THEN
        RAISE EXCEPTION 'only admin can confirm an opportunity as won'
            USING ERRCODE = '42501';
    END IF;

    CASE current_opportunity.stage
        WHEN 'invoice_received' THEN
            transition_allowed := p_to_stage IN ('data_review', 'lost');
        WHEN 'data_review' THEN
            transition_allowed := p_to_stage IN ('proposal_preparation', 'lost');
        WHEN 'proposal_preparation' THEN
            transition_allowed := p_to_stage IN ('proposal_sent', 'lost');
        WHEN 'proposal_sent' THEN
            transition_allowed := p_to_stage IN ('accepted', 'lost');
        WHEN 'accepted' THEN
            transition_allowed := p_to_stage IN ('activation', 'lost');
        WHEN 'activation' THEN
            transition_allowed := p_to_stage IN ('won', 'lost');
        WHEN 'lost' THEN
            IF actor_role <> 'admin' OR p_reason_code <> 'reopen' THEN
                transition_allowed := false;
            ELSE
                SELECT history.from_stage
                INTO reopen_stage
                FROM public.opportunity_stage_history history
                WHERE history.opportunity_id = current_opportunity.id
                  AND history.to_stage = 'lost'
                ORDER BY history.created_at DESC
                LIMIT 1;

                transition_allowed := reopen_stage IS NOT NULL
                    AND reopen_stage NOT IN ('won', 'lost')
                    AND p_to_stage = reopen_stage;
            END IF;
        ELSE
            transition_allowed := false;
    END CASE;

    IF NOT transition_allowed THEN
        RAISE EXCEPTION 'invalid opportunity transition'
            USING ERRCODE = '22023';
    END IF;

    IF p_to_stage = 'lost'
       AND (p_loss_reason IS NULL OR btrim(p_loss_reason) = '')
    THEN
        RAISE EXCEPTION 'loss reason is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_loss_reason IS NOT NULL AND length(p_loss_reason) > 500 THEN
        RAISE EXCEPTION 'loss reason is too long'
            USING ERRCODE = '22023';
    END IF;

    target_next_action_type := CASE p_to_stage
        WHEN 'invoice_received' THEN 'wait_for_ocr'
        WHEN 'data_review' THEN 'review_invoice'
        WHEN 'proposal_preparation' THEN 'compare_tariffs'
        WHEN 'proposal_sent' THEN 'follow_up_proposal'
        WHEN 'accepted' THEN 'complete_activation'
        WHEN 'activation' THEN 'resolve_activation'
        ELSE NULL
    END;

    target_next_action_title := CASE p_to_stage
        WHEN 'invoice_received' THEN 'Ver estado del OCR'
        WHEN 'data_review' THEN 'Revisar factura'
        WHEN 'proposal_preparation' THEN 'Comparar tarifas'
        WHEN 'proposal_sent' THEN 'Registrar seguimiento'
        WHEN 'accepted' THEN 'Completar alta'
        WHEN 'activation' THEN 'Resolver requisitos de alta'
        ELSE NULL
    END;

    UPDATE public.opportunities
    SET
        stage = p_to_stage,
        stage_entered_at = transition_at,
        next_action_type = target_next_action_type,
        next_action_title = target_next_action_title,
        next_action_due_at = CASE
            WHEN p_to_stage IN ('won', 'lost') THEN NULL
            ELSE p_next_action_due_at
        END,
        won_at = CASE WHEN p_to_stage = 'won' THEN transition_at ELSE NULL END,
        lost_at = CASE WHEN p_to_stage = 'lost' THEN transition_at ELSE NULL END,
        loss_reason = CASE WHEN p_to_stage = 'lost' THEN btrim(p_loss_reason) ELSE NULL END,
        closed_at = CASE
            WHEN p_to_stage IN ('won', 'lost') THEN transition_at
            ELSE NULL
        END
    WHERE id = current_opportunity.id
      AND stage = p_expected_stage
    RETURNING *
    INTO updated_opportunity;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'opportunity stage changed'
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
    )
    VALUES (
        current_opportunity.id,
        current_opportunity.stage,
        updated_opportunity.stage,
        p_actor_id,
        p_reason_code,
        p_safe_metadata,
        transition_at
    );

    RETURN updated_opportunity;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_crm_opportunity(
    uuid,
    text,
    text,
    uuid,
    text,
    jsonb,
    timestamptz,
    text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.transition_crm_opportunity(
    uuid,
    text,
    text,
    uuid,
    text,
    jsonb,
    timestamptz,
    text
) TO service_role;

COMMENT ON FUNCTION public.transition_crm_opportunity(
    uuid,
    text,
    text,
    uuid,
    text,
    jsonb,
    timestamptz,
    text
) IS 'Atomically validates and records a canonical CRM opportunity transition. Server service role only.';

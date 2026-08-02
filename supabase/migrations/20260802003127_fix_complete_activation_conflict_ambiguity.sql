BEGIN;

CREATE OR REPLACE FUNCTION public.complete_crm_activation(
    p_proposal_id uuid,
    p_actor_id uuid,
    p_marketer_name text,
    p_tariff_name text,
    p_start_date date,
    p_permanence_status text,
    p_end_date date DEFAULT NULL
)
RETURNS TABLE (proposal_id uuid, opportunity_id uuid, contract_id uuid, client_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
    proposal public.proposals%ROWTYPE;
    opportunity public.opportunities%ROWTYPE;
    contract public.contracts%ROWTYPE;
    transition_at timestamptz := clock_timestamp();
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles actor
        WHERE actor.id = p_actor_id AND actor.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'activation confirmation unavailable' USING ERRCODE = '42501';
    END IF;

    IF p_marketer_name IS NULL OR btrim(p_marketer_name) = '' OR length(p_marketer_name) > 120
       OR p_tariff_name IS NULL OR btrim(p_tariff_name) = '' OR length(p_tariff_name) > 160
       OR p_start_date IS NULL OR p_start_date > current_date
       OR p_permanence_status NOT IN ('known', 'none', 'unknown')
       OR (p_permanence_status = 'known' AND (p_end_date IS NULL OR p_end_date < p_start_date))
       OR (p_permanence_status = 'none' AND p_end_date IS NOT NULL)
    THEN
        RAISE EXCEPTION 'invalid activation details' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO proposal
    FROM public.proposals
    WHERE id = p_proposal_id
    FOR UPDATE;

    IF NOT FOUND OR proposal.status <> 'accepted' OR proposal.alta_status <> 'en_alta'
       OR proposal.opportunity_id IS NULL OR proposal.supply_point_id IS NULL
       OR proposal.client_id IS NULL OR proposal.agent_id IS NULL
    THEN
        RAISE EXCEPTION 'activation unavailable' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO opportunity
    FROM public.opportunities
    WHERE id = proposal.opportunity_id
    FOR UPDATE;

    IF NOT FOUND OR opportunity.stage <> 'activation'
       OR opportunity.client_id IS DISTINCT FROM proposal.client_id
       OR opportunity.supply_point_id IS DISTINCT FROM proposal.supply_point_id
       OR opportunity.owner_id IS DISTINCT FROM proposal.agent_id
       OR opportunity.franchise_id IS DISTINCT FROM proposal.franchise_id
    THEN
        RAISE EXCEPTION 'activation opportunity mismatch' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.contracts (
        client_id, proposal_id, opportunity_id, supply_point_id,
        agent_id, franchise_id, marketer_name, tariff_name,
        contract_type, status, annual_savings, start_date, end_date,
        permanence_status, updated_at
    ) VALUES (
        proposal.client_id, proposal.id, opportunity.id, opportunity.supply_point_id,
        opportunity.owner_id, opportunity.franchise_id, btrim(p_marketer_name), btrim(p_tariff_name),
        'electricidad', 'active', proposal.annual_savings, p_start_date,
        CASE WHEN p_permanence_status = 'known' THEN p_end_date ELSE NULL END,
        p_permanence_status, transition_at
    )
    ON CONFLICT (proposal_id) WHERE proposal_id IS NOT NULL
    DO UPDATE SET
        opportunity_id = EXCLUDED.opportunity_id,
        supply_point_id = EXCLUDED.supply_point_id,
        client_id = EXCLUDED.client_id,
        agent_id = EXCLUDED.agent_id,
        franchise_id = EXCLUDED.franchise_id,
        marketer_name = EXCLUDED.marketer_name,
        tariff_name = EXCLUDED.tariff_name,
        status = 'active',
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        permanence_status = EXCLUDED.permanence_status,
        updated_at = transition_at
    RETURNING * INTO contract;

    UPDATE public.proposals
    SET alta_status = 'activada', alta_completada_at = transition_at, alta_completada_by = p_actor_id
    WHERE id = proposal.id AND alta_status = 'en_alta';

    PERFORM public.transition_crm_opportunity(
        opportunity.id, 'activation', 'won', p_actor_id,
        'activation_confirmed', '{"source":"activation_workflow"}'::jsonb,
        NULL, NULL
    );

    UPDATE public.clients
    SET status = 'won', updated_at = transition_at
    WHERE id = proposal.client_id;

    INSERT INTO public.proposal_alta_events (proposal_id, actor_id, event_type, detail, metadata)
    VALUES (proposal.id, p_actor_id, 'alta_completed', 'Activación y contrato confirmados', '{}'::jsonb);

    INSERT INTO public.client_activities (
        client_id, agent_id, franchise_id, type, description, metadata
    ) VALUES (
        proposal.client_id, opportunity.owner_id, opportunity.franchise_id,
        'contract_activated', 'Contrato activado por la distribuidora.',
        jsonb_build_object('proposal_id', proposal.id, 'opportunity_id', opportunity.id, 'contract_id', contract.id)
    );

    RETURN QUERY SELECT proposal.id, opportunity.id, contract.id, proposal.client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_crm_activation(uuid,uuid,text,text,date,text,date)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_crm_activation(uuid,uuid,text,text,date,text,date)
TO service_role;

COMMENT ON FUNCTION public.complete_crm_activation(uuid,uuid,text,text,date,text,date)
IS 'Atomically confirms activation, activates the contract and closes the canonical opportunity. Admin server workflow only.';

COMMIT;

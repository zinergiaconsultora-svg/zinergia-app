-- Admin-only, non-PII acceptance reconciliation queue and state repair.

CREATE VIEW public.proposal_acceptance_integrity
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
    proposal.id AS proposal_id,
    proposal.opportunity_id,
    proposal.agent_id AS owner_id,
    proposal.franchise_id,
    COALESCE(proposal.public_accepted_at, proposal.accepted_date, proposal.updated_at) AS accepted_at,
    opportunity.stage AS opportunity_stage,
    (proposal.opportunity_id IS NULL) AS missing_opportunity,
    (
        proposal.alta_status IS NULL
        OR opportunity.stage = 'accepted'
    ) AS missing_activation,
    (commission.id IS NULL) AS missing_commission,
    (contract.id IS NULL) AS missing_contract,
    (
        (proposal.opportunity_id IS NULL)::integer
        + (proposal.alta_status IS NULL OR opportunity.stage = 'accepted')::integer
        + (commission.id IS NULL)::integer
        + (contract.id IS NULL)::integer
    ) AS issue_count
FROM public.proposals proposal
LEFT JOIN public.opportunities opportunity
    ON opportunity.id = proposal.opportunity_id
   AND opportunity.client_id = proposal.client_id
   AND opportunity.owner_id = proposal.agent_id
LEFT JOIN public.network_commissions commission
    ON commission.proposal_id = proposal.id
   AND commission.opportunity_id IS NOT DISTINCT FROM proposal.opportunity_id
   AND commission.agent_id = proposal.agent_id
LEFT JOIN public.contracts contract
    ON contract.proposal_id = proposal.id
   AND contract.opportunity_id IS NOT DISTINCT FROM proposal.opportunity_id
   AND contract.client_id = proposal.client_id
   AND contract.agent_id = proposal.agent_id
   AND contract.supply_point_id IS NOT DISTINCT FROM proposal.supply_point_id
WHERE proposal.status = 'accepted'
  AND public.is_superadmin()
  AND (
      proposal.opportunity_id IS NULL
      OR proposal.alta_status IS NULL
      OR opportunity.stage = 'accepted'
      OR commission.id IS NULL
      OR contract.id IS NULL
  );

REVOKE ALL ON public.proposal_acceptance_integrity FROM PUBLIC, anon;
GRANT SELECT ON public.proposal_acceptance_integrity TO authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_crm_acceptance_state(
    p_proposal_id uuid,
    p_actor_id uuid
)
RETURNS TABLE (
    proposal_id uuid,
    opportunity_id uuid,
    owner_id uuid,
    opportunity_stage text,
    activation_repaired boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    proposal public.proposals%ROWTYPE;
    opportunity public.opportunities%ROWTYPE;
    repaired boolean := false;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles actor
        WHERE actor.id = p_actor_id
          AND actor.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'acceptance reconciliation unavailable'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO proposal
    FROM public.proposals
    WHERE id = p_proposal_id
    FOR UPDATE;

    IF NOT FOUND OR proposal.status <> 'accepted' OR proposal.opportunity_id IS NULL THEN
        RAISE EXCEPTION 'accepted proposal unavailable'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO opportunity
    FROM public.opportunities
    WHERE id = proposal.opportunity_id
    FOR UPDATE;

    IF NOT FOUND
       OR opportunity.client_id IS DISTINCT FROM proposal.client_id
       OR opportunity.supply_point_id IS DISTINCT FROM proposal.supply_point_id
       OR opportunity.owner_id IS DISTINCT FROM proposal.agent_id
       OR opportunity.franchise_id IS DISTINCT FROM proposal.franchise_id
    THEN
        RAISE EXCEPTION 'acceptance opportunity mismatch'
            USING ERRCODE = '23514';
    END IF;

    IF proposal.alta_status IS NULL THEN
        UPDATE public.proposals
        SET alta_status = 'pendiente_consent'
        WHERE id = proposal.id
          AND alta_status IS NULL;
        repaired := true;
    END IF;

    IF opportunity.stage = 'accepted' THEN
        SELECT *
        INTO opportunity
        FROM public.transition_crm_opportunity(
            opportunity.id,
            'accepted',
            'activation',
            p_actor_id,
            'acceptance_reconciliation',
            '{"source":"acceptance_integrity"}'::jsonb,
            NULL,
            NULL
        );
        repaired := true;
    ELSIF opportunity.stage NOT IN ('activation', 'won') THEN
        RAISE EXCEPTION 'acceptance opportunity state mismatch'
            USING ERRCODE = '23514';
    END IF;

    RETURN QUERY
    SELECT proposal.id, opportunity.id, opportunity.owner_id, opportunity.stage, repaired;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_crm_acceptance_state(uuid, uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_crm_acceptance_state(uuid, uuid)
    TO service_role;

COMMENT ON VIEW public.proposal_acceptance_integrity
IS 'Admin-only non-PII queue of accepted proposals missing canonical durable effects.';

COMMENT ON FUNCTION public.reconcile_crm_acceptance_state(uuid, uuid)
IS 'Repairs accepted-to-activation state under row locks. Server service role and admin actor only.';

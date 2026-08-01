BEGIN;

CREATE OR REPLACE VIEW public.proposal_acceptance_integrity
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
  AND (select private.is_superadmin())
  AND (
      proposal.opportunity_id IS NULL
      OR proposal.alta_status IS NULL
      OR opportunity.stage = 'accepted'
      OR commission.id IS NULL
      OR contract.id IS NULL
  );

REVOKE ALL ON public.proposal_acceptance_integrity FROM PUBLIC, anon;
GRANT SELECT ON public.proposal_acceptance_integrity TO authenticated, service_role;

COMMENT ON VIEW public.proposal_acceptance_integrity
IS 'Admin-only non-PII queue of accepted proposals missing canonical durable effects.';

COMMIT;

-- Deterministic CRM opportunity backfill.
-- Target: staging first; production only after reviewed promotion.
-- Operator date: set by execution evidence in the SDD task log.
--
-- Eligibility:
-- - accepted proposal
-- - exactly one supply point for the proposal client
-- - accountable owner exists
-- - no competing open activation for the same supply point
-- - no existing open switch opportunity for that supply point
--
-- The proposal UUID is reused as the opportunity UUID to make reruns stable.
-- Ambiguous rows are intentionally skipped and reported separately by
-- report_crm_opportunity_backfill_candidates.sql.
--
-- Rollback before application opportunity writes:
-- 1. Null linked opportunity_id/supply_point_id values for opportunities whose
--    source is legacy_accepted_proposal.
-- 2. Delete their stage history.
-- 3. Delete those opportunities.
-- Do not use destructive rollback after application writes begin.

BEGIN;

CREATE TEMP TABLE crm_opportunity_backfill_candidates
ON COMMIT DROP
AS
WITH supply_counts AS (
    SELECT
        client_id,
        count(*)::integer AS supply_count,
        min(id::text)::uuid AS only_supply_point_id
    FROM public.supply_points
    GROUP BY client_id
),
accepted AS (
    SELECT
        proposal.id AS proposal_id,
        proposal.client_id,
        supply.only_supply_point_id AS supply_point_id,
        coalesce(proposal.agent_id, client.owner_id) AS owner_id,
        coalesce(proposal.franchise_id, client.franchise_id) AS franchise_id,
        CASE
            WHEN proposal.alta_status = 'rechazada' THEN 'lost'
            WHEN contract.status IN ('active', 'expired', 'cancelled') THEN 'won'
            ELSE 'activation'
        END AS target_stage,
        CASE
            WHEN proposal.alta_status = 'rechazada'
            THEN coalesce(proposal.alta_rejected_at, proposal.updated_at, now())
            WHEN contract.status IN ('active', 'expired', 'cancelled')
            THEN coalesce(
                proposal.alta_completada_at,
                contract.start_date::timestamptz,
                proposal.public_accepted_at,
                proposal.accepted_date::timestamptz,
                proposal.updated_at,
                now()
            )
            ELSE coalesce(
                proposal.public_accepted_at,
                proposal.accepted_date::timestamptz,
                proposal.updated_at,
                now()
            )
        END AS target_stage_entered_at
    FROM public.proposals proposal
    JOIN public.clients client ON client.id = proposal.client_id
    JOIN supply_counts supply
        ON supply.client_id = proposal.client_id
       AND supply.supply_count = 1
    JOIN public.profiles owner
        ON owner.id = coalesce(proposal.agent_id, client.owner_id)
    LEFT JOIN public.contracts contract ON contract.proposal_id = proposal.id
    WHERE proposal.status = 'accepted'
      AND proposal.opportunity_id IS NULL
),
with_activation_count AS (
    SELECT
        accepted.*,
        count(*) FILTER (
            WHERE target_stage = 'activation'
        ) OVER (PARTITION BY supply_point_id) AS open_activation_count
    FROM accepted
)
SELECT *
FROM with_activation_count candidate
WHERE (
        candidate.target_stage <> 'activation'
        OR candidate.open_activation_count = 1
    )
  AND NOT EXISTS (
      SELECT 1
      FROM public.opportunities existing
      WHERE existing.supply_point_id = candidate.supply_point_id
        AND existing.type = 'switch'
        AND existing.closed_at IS NULL
  );

INSERT INTO public.opportunities (
    id,
    client_id,
    supply_point_id,
    owner_id,
    franchise_id,
    type,
    stage,
    source,
    stage_entered_at,
    next_action_type,
    next_action_title,
    won_at,
    lost_at,
    loss_reason,
    closed_at,
    created_at,
    updated_at
)
SELECT
    candidate.proposal_id,
    candidate.client_id,
    candidate.supply_point_id,
    candidate.owner_id,
    candidate.franchise_id,
    'switch',
    candidate.target_stage,
    'legacy_accepted_proposal',
    candidate.target_stage_entered_at,
    CASE
        WHEN candidate.target_stage = 'activation' THEN 'resolve_activation'
        ELSE NULL
    END,
    CASE
        WHEN candidate.target_stage = 'activation' THEN 'Resolver requisitos de alta'
        ELSE NULL
    END,
    CASE
        WHEN candidate.target_stage = 'won' THEN candidate.target_stage_entered_at
        ELSE NULL
    END,
    CASE
        WHEN candidate.target_stage = 'lost' THEN candidate.target_stage_entered_at
        ELSE NULL
    END,
    CASE
        WHEN candidate.target_stage = 'lost' THEN 'legacy_alta_rejected'
        ELSE NULL
    END,
    CASE
        WHEN candidate.target_stage IN ('won', 'lost')
        THEN candidate.target_stage_entered_at
        ELSE NULL
    END,
    candidate.target_stage_entered_at,
    candidate.target_stage_entered_at
FROM crm_opportunity_backfill_candidates candidate
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.opportunity_stage_history (
    opportunity_id,
    from_stage,
    to_stage,
    actor_id,
    reason_code,
    safe_metadata,
    created_at
)
SELECT
    candidate.proposal_id,
    NULL,
    candidate.target_stage,
    NULL,
    'legacy_backfill',
    jsonb_build_object(
        'source', 'legacy_accepted_proposal',
        'proposal_status', 'accepted'
    ),
    candidate.target_stage_entered_at
FROM crm_opportunity_backfill_candidates candidate
WHERE EXISTS (
    SELECT 1
    FROM public.opportunities opportunity
    WHERE opportunity.id = candidate.proposal_id
)
AND NOT EXISTS (
    SELECT 1
    FROM public.opportunity_stage_history history
    WHERE history.opportunity_id = candidate.proposal_id
      AND history.reason_code = 'legacy_backfill'
);

UPDATE public.proposals proposal
SET
    opportunity_id = candidate.proposal_id,
    supply_point_id = candidate.supply_point_id
FROM crm_opportunity_backfill_candidates candidate
WHERE proposal.id = candidate.proposal_id
  AND EXISTS (
      SELECT 1
      FROM public.opportunities opportunity
      WHERE opportunity.id = candidate.proposal_id
  );

UPDATE public.contracts contract
SET
    opportunity_id = candidate.proposal_id,
    supply_point_id = candidate.supply_point_id
FROM crm_opportunity_backfill_candidates candidate
WHERE contract.proposal_id = candidate.proposal_id;

UPDATE public.network_commissions commission
SET opportunity_id = candidate.proposal_id
FROM crm_opportunity_backfill_candidates candidate
WHERE commission.proposal_id = candidate.proposal_id;

UPDATE public.tasks task
SET opportunity_id = candidate.proposal_id
FROM crm_opportunity_backfill_candidates candidate
WHERE task.proposal_id = candidate.proposal_id
  AND task.client_id = candidate.client_id;

WITH unique_accepted_ocr AS (
    SELECT proposal.ocr_job_id
    FROM public.proposals proposal
    WHERE proposal.status = 'accepted'
      AND proposal.ocr_job_id IS NOT NULL
    GROUP BY proposal.ocr_job_id
    HAVING count(*) = 1
)
UPDATE public.ocr_jobs job
SET
    opportunity_id = candidate.proposal_id,
    supply_point_id = candidate.supply_point_id
FROM crm_opportunity_backfill_candidates candidate
JOIN public.proposals proposal ON proposal.id = candidate.proposal_id
JOIN unique_accepted_ocr unique_ocr
    ON unique_ocr.ocr_job_id = proposal.ocr_job_id
WHERE job.id = proposal.ocr_job_id
  AND job.client_id = candidate.client_id;

SELECT
    'eligible_candidates'::text AS result,
    count(*)::bigint AS row_count
FROM crm_opportunity_backfill_candidates

UNION ALL

SELECT
    'legacy_opportunities_present',
    count(*)::bigint
FROM public.opportunities
WHERE source = 'legacy_accepted_proposal'

ORDER BY result;

COMMIT;

-- CRM opportunity legacy-backfill ambiguity report.
-- Read-only and PII-safe: proposal UUID plus reason only.

WITH supply_counts AS (
    SELECT
        client_id,
        count(*)::integer AS supply_count
    FROM public.supply_points
    GROUP BY client_id
),
accepted AS (
    SELECT
        proposal.id AS proposal_id,
        proposal.opportunity_id,
        coalesce(supply.supply_count, 0) AS supply_count,
        coalesce(proposal.agent_id, client.owner_id) AS owner_id,
        (profile.id IS NOT NULL) AS owner_exists
    FROM public.proposals proposal
    JOIN public.clients client ON client.id = proposal.client_id
    LEFT JOIN supply_counts supply ON supply.client_id = proposal.client_id
    LEFT JOIN public.profiles profile
        ON profile.id = coalesce(proposal.agent_id, client.owner_id)
    WHERE proposal.status = 'accepted'
)
SELECT
    proposal_id,
    CASE
        WHEN supply_count = 0 THEN 'missing_supply_point'
        WHEN supply_count > 1 THEN 'multiple_supply_points'
        WHEN NOT owner_exists THEN 'missing_owner'
        ELSE 'requires_cycle_review'
    END AS reason
FROM accepted
WHERE opportunity_id IS NULL
  AND (
      supply_count <> 1
      OR NOT owner_exists
  )
ORDER BY reason, proposal_id;

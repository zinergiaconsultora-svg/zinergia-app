-- CRM opportunity legacy-backfill candidate report.
-- Target: staging first, production only after reviewed promotion.
-- Read-only and aggregate-only: returns no client, supply or proposal identifiers.

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
        proposal.opportunity_id,
        proposal.client_id,
        coalesce(proposal.agent_id, client.owner_id) AS owner_id,
        coalesce(proposal.franchise_id, client.franchise_id) AS franchise_id,
        coalesce(supply.supply_count, 0) AS supply_count,
        supply.only_supply_point_id AS supply_point_id,
        CASE
            WHEN proposal.alta_status = 'rechazada' THEN 'lost'
            WHEN contract.status IN ('active', 'expired', 'cancelled') THEN 'won'
            ELSE 'activation'
        END AS target_stage,
        (profile.id IS NOT NULL) AS owner_exists
    FROM public.proposals proposal
    JOIN public.clients client ON client.id = proposal.client_id
    LEFT JOIN supply_counts supply ON supply.client_id = proposal.client_id
    LEFT JOIN public.profiles profile
        ON profile.id = coalesce(proposal.agent_id, client.owner_id)
    LEFT JOIN public.contracts contract ON contract.proposal_id = proposal.id
    WHERE proposal.status = 'accepted'
),
classified AS (
    SELECT
        accepted.*,
        CASE
            WHEN opportunity_id IS NOT NULL THEN 'already_backfilled'
            WHEN supply_count = 0 THEN 'ambiguous_no_supply_point'
            WHEN supply_count > 1 THEN 'ambiguous_multiple_supply_points'
            WHEN NOT owner_exists THEN 'invalid_missing_owner'
            ELSE 'candidate'
        END AS classification
    FROM accepted
),
with_activation_count AS (
    SELECT
        classified.*,
        count(*) FILTER (
            WHERE classification = 'candidate'
              AND target_stage = 'activation'
        ) OVER (PARTITION BY supply_point_id) AS open_activation_count
    FROM classified
),
final_classification AS (
    SELECT
        CASE
            WHEN classification = 'candidate'
              AND target_stage = 'activation'
              AND open_activation_count > 1
            THEN 'ambiguous_multiple_open_activations'
            WHEN classification = 'candidate'
            THEN 'eligible_' || target_stage
            ELSE classification
        END AS result
    FROM with_activation_count
)
SELECT result, count(*)::bigint AS proposal_count
FROM final_classification
GROUP BY result
ORDER BY result;

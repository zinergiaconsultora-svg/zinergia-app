-- CRM opportunity foundation preflight.
-- Target: staging first, then production before promotion.
-- Read-only: this script must return zero rows before migration apply.

WITH blockers AS (
    SELECT
        'duplicate_contract_for_proposal'::text AS check_type,
        proposal_id::text AS item,
        count(*)::bigint AS occurrences
    FROM public.contracts
    WHERE proposal_id IS NOT NULL
    GROUP BY proposal_id
    HAVING count(*) > 1

    UNION ALL

    SELECT
        'duplicate_supply_point_hash',
        cups_hash,
        count(*)::bigint
    FROM public.supply_points
    WHERE cups_hash IS NOT NULL
    GROUP BY cups_hash
    HAVING count(*) > 1

    UNION ALL

    SELECT
        'orphan_supply_point',
        sp.id::text,
        1::bigint
    FROM public.supply_points sp
    LEFT JOIN public.clients client ON client.id = sp.client_id
    WHERE client.id IS NULL

    UNION ALL

    SELECT
        'plaintext_supply_point_cups',
        sp.id::text,
        1::bigint
    FROM public.supply_points sp
    WHERE sp.cups IS NOT NULL

    UNION ALL

    SELECT
        'foundation_table_already_exists',
        relation_name,
        1::bigint
    FROM (
        VALUES
            ('public.opportunities'),
            ('public.opportunity_stage_history')
    ) AS expected(relation_name)
    WHERE to_regclass(relation_name) IS NOT NULL
)
SELECT check_type, item, occurrences
FROM blockers
ORDER BY check_type, item;

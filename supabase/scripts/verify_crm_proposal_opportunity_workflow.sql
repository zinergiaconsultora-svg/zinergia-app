-- Target: staging after 20260731162336_crm_proposal_opportunity_workflow.sql.
-- Read-only verification. An empty result set means no linked-record drift was found.

DO $$
BEGIN
    IF to_regprocedure('public.send_crm_proposal(uuid,uuid,text,timestamp with time zone)') IS NULL THEN
        RAISE EXCEPTION 'send_crm_proposal is missing';
    END IF;

    IF to_regprocedure('public.accept_crm_public_proposal(text,text,text)') IS NULL THEN
        RAISE EXCEPTION 'accept_crm_public_proposal is missing';
    END IF;

    IF has_function_privilege(
        'anon',
        'public.send_crm_proposal(uuid,uuid,text,timestamp with time zone)',
        'EXECUTE'
    ) OR has_function_privilege(
        'authenticated',
        'public.send_crm_proposal(uuid,uuid,text,timestamp with time zone)',
        'EXECUTE'
    ) OR has_function_privilege(
        'anon',
        'public.accept_crm_public_proposal(text,text,text)',
        'EXECUTE'
    ) OR has_function_privilege(
        'authenticated',
        'public.accept_crm_public_proposal(text,text,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'proposal workflow RPC is exposed outside service_role';
    END IF;

    IF NOT has_function_privilege(
        'service_role',
        'public.send_crm_proposal(uuid,uuid,text,timestamp with time zone)',
        'EXECUTE'
    ) OR NOT has_function_privilege(
        'service_role',
        'public.accept_crm_public_proposal(text,text,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'service_role cannot execute proposal workflow RPC';
    END IF;
END;
$$;

SELECT
    proposal.id AS proposal_id,
    proposal.opportunity_id,
    'linked_record_mismatch' AS issue
FROM public.proposals proposal
JOIN public.opportunities opportunity ON opportunity.id = proposal.opportunity_id
WHERE proposal.client_id IS DISTINCT FROM opportunity.client_id
   OR proposal.supply_point_id IS DISTINCT FROM opportunity.supply_point_id
   OR proposal.agent_id IS DISTINCT FROM opportunity.owner_id
   OR proposal.franchise_id IS DISTINCT FROM opportunity.franchise_id
UNION ALL
SELECT
    proposal.id AS proposal_id,
    proposal.opportunity_id,
    'active_proposal_without_opportunity' AS issue
FROM public.proposals proposal
WHERE proposal.status IN ('sent', 'accepted')
  AND proposal.opportunity_id IS NULL
ORDER BY proposal_id;

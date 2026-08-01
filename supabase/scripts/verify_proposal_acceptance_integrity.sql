-- Target: staging after 20260731181410_proposal_acceptance_integrity.sql.
-- Read-only privilege, shape and queue verification.

DO $$
DECLARE
    unsafe_columns integer;
BEGIN
    IF to_regclass('public.proposal_acceptance_integrity') IS NULL THEN
        RAISE EXCEPTION 'proposal_acceptance_integrity is missing';
    END IF;

    SELECT count(*)
    INTO unsafe_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposal_acceptance_integrity'
      AND column_name ~* '(name|email|phone|address|cups|dni|nif|cif|iban|token|signature)';

    IF unsafe_columns <> 0 THEN
        RAISE EXCEPTION 'acceptance integrity view exposes unsafe columns';
    END IF;

    IF has_table_privilege('anon', 'public.proposal_acceptance_integrity', 'SELECT') THEN
        RAISE EXCEPTION 'anon can read acceptance integrity view';
    END IF;

    IF NOT has_table_privilege('authenticated', 'public.proposal_acceptance_integrity', 'SELECT') THEN
        RAISE EXCEPTION 'authenticated cannot read RLS-filtered acceptance integrity view';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'public.reconcile_crm_acceptance_state(uuid,uuid)',
        'EXECUTE'
    ) OR has_function_privilege(
        'anon',
        'public.reconcile_crm_acceptance_state(uuid,uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'acceptance reconciliation RPC is publicly executable';
    END IF;

    IF NOT has_function_privilege(
        'service_role',
        'public.reconcile_crm_acceptance_state(uuid,uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'service_role cannot execute acceptance reconciliation RPC';
    END IF;
END;
$$;

SELECT
    proposal.id AS proposal_id,
    proposal.opportunity_id,
    (proposal.alta_status IS NULL) AS missing_activation_record,
    NOT EXISTS (
        SELECT 1 FROM public.network_commissions commission
        WHERE commission.proposal_id = proposal.id
    ) AS missing_commission,
    NOT EXISTS (
        SELECT 1 FROM public.contracts contract
        WHERE contract.proposal_id = proposal.id
    ) AS missing_contract
FROM public.proposals proposal
WHERE proposal.status = 'accepted'
  AND (
      proposal.opportunity_id IS NULL
      OR proposal.alta_status IS NULL
      OR NOT EXISTS (
          SELECT 1 FROM public.network_commissions commission
          WHERE commission.proposal_id = proposal.id
      )
      OR NOT EXISTS (
          SELECT 1 FROM public.contracts contract
          WHERE contract.proposal_id = proposal.id
      )
  )
ORDER BY proposal.created_at;

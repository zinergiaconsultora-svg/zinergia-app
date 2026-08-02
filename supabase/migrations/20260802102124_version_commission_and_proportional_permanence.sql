BEGIN;

-- Reconcile the pre-existing model before enforcing one current version per
-- channel. Historical versions keep their original effective_from value.
DO $$
DECLARE
    migration_at timestamptz := clock_timestamp();
    stale_assignment record;
    current_plan_id uuid;
BEGIN
    WITH ordered AS (
        SELECT
            id,
            effective_from,
            lead(effective_from) OVER (
                PARTITION BY code
                ORDER BY version, effective_from, id
            ) AS next_effective_from,
            row_number() OVER (
                PARTITION BY code
                ORDER BY version DESC, effective_from DESC, id DESC
            ) AS newest_rank
        FROM public.commission_plans
    )
    UPDATE public.commission_plans plan
    SET is_active = ordered.newest_rank = 1,
        effective_to = CASE
            WHEN ordered.newest_rank = 1 THEN NULL
            ELSE greatest(
                coalesce(ordered.next_effective_from, migration_at),
                ordered.effective_from + interval '1 microsecond'
            )
        END
    FROM ordered
    WHERE plan.id = ordered.id;

    FOR stale_assignment IN
        SELECT assignment.*
        FROM public.commission_plan_assignments assignment
        JOIN public.commission_plans assigned_plan ON assigned_plan.id = assignment.plan_id
        WHERE assignment.effective_to IS NULL
          AND assigned_plan.is_active IS FALSE
        FOR UPDATE OF assignment
    LOOP
        SELECT plan.id
        INTO current_plan_id
        FROM public.commission_plans plan
        JOIN public.commission_plans assigned_plan ON assigned_plan.id = stale_assignment.plan_id
        WHERE plan.code = assigned_plan.code
          AND plan.is_active
        LIMIT 1;

        IF current_plan_id IS NOT NULL THEN
            UPDATE public.commission_plan_assignments
            SET effective_to = greatest(
                migration_at,
                stale_assignment.effective_from + interval '1 microsecond'
            )
            WHERE id = stale_assignment.id;

            INSERT INTO public.commission_plan_assignments (
                commercial_id,
                plan_id,
                effective_from,
                assigned_by,
                reason
            ) VALUES (
                stale_assignment.commercial_id,
                current_plan_id,
                greatest(migration_at, stale_assignment.effective_from + interval '1 microsecond'),
                stale_assignment.assigned_by,
                'Migración a la versión económica vigente'
            );
        END IF;
    END LOOP;
END;
$$;

CREATE UNIQUE INDEX commission_plans_one_active_code_idx
    ON public.commission_plans (code)
    WHERE is_active;

COMMENT ON INDEX public.commission_plans_one_active_code_idx IS
    'Enforces exactly zero or one current plan version per economic channel.';

CREATE OR REPLACE FUNCTION public.version_commission_plan(
    p_actor_id uuid,
    p_channel text,
    p_name text,
    p_commercial_share_bps integer,
    p_franchise_share_bps integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    plan_code text := p_channel;
    central_share_bps integer := 10000 - p_commercial_share_bps - p_franchise_share_bps;
    effective_at timestamptz := clock_timestamp();
    previous_plan public.commission_plans%ROWTYPE;
    other_plan public.commission_plans%ROWTYPE;
    assignment public.commission_plan_assignments%ROWTYPE;
    new_plan_id uuid;
    new_version integer;
    migrated_assignments integer := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'commission plan version unavailable' USING ERRCODE = '42501';
    END IF;

    IF p_channel NOT IN ('partner_direct', 'franchise_network')
       OR length(btrim(coalesce(p_name, ''))) < 3
       OR p_commercial_share_bps NOT BETWEEN 0 AND 10000
       OR p_franchise_share_bps NOT BETWEEN 0 AND 10000
       OR central_share_bps NOT BETWEEN 0 AND 10000
       OR (p_channel = 'partner_direct' AND p_franchise_share_bps <> 0)
    THEN
        RAISE EXCEPTION 'invalid commission plan version' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('commission-plan:' || plan_code, 0));

    SELECT *
    INTO previous_plan
    FROM public.commission_plans
    WHERE code = plan_code
      AND is_active
    FOR UPDATE;

    SELECT *
    INTO other_plan
    FROM public.commission_plans
    WHERE code = CASE
        WHEN p_channel = 'partner_direct' THEN 'franchise_network'
        ELSE 'partner_direct'
    END
      AND is_active
    LIMIT 1;

    IF other_plan.id IS NOT NULL AND (
        (p_channel = 'partner_direct' AND (
            p_commercial_share_bps <= other_plan.commercial_share_bps
            OR central_share_bps >= other_plan.central_share_bps
        ))
        OR
        (p_channel = 'franchise_network' AND (
            p_commercial_share_bps >= other_plan.commercial_share_bps
            OR central_share_bps <= other_plan.central_share_bps
        ))
    ) THEN
        RAISE EXCEPTION 'commission channel relationship is invalid' USING ERRCODE = '23514';
    END IF;

    IF previous_plan.id IS NOT NULL THEN
        effective_at := greatest(effective_at, previous_plan.effective_from + interval '1 microsecond');
        UPDATE public.commission_plans
        SET effective_to = effective_at,
            is_active = false
        WHERE id = previous_plan.id;
    END IF;

    SELECT coalesce(max(version), 0) + 1
    INTO new_version
    FROM public.commission_plans
    WHERE code = plan_code;

    INSERT INTO public.commission_plans (
        code,
        version,
        name,
        channel,
        commercial_share_bps,
        franchise_share_bps,
        central_share_bps,
        effective_from,
        created_by
    ) VALUES (
        plan_code,
        new_version,
        btrim(p_name),
        p_channel,
        p_commercial_share_bps,
        p_franchise_share_bps,
        central_share_bps,
        effective_at,
        p_actor_id
    )
    RETURNING id INTO new_plan_id;

    IF previous_plan.id IS NOT NULL THEN
        FOR assignment IN
            SELECT *
            FROM public.commission_plan_assignments
            WHERE plan_id = previous_plan.id
              AND effective_to IS NULL
            FOR UPDATE
        LOOP
            UPDATE public.commission_plan_assignments
            SET effective_to = effective_at
            WHERE id = assignment.id;

            INSERT INTO public.commission_plan_assignments (
                commercial_id,
                plan_id,
                effective_from,
                assigned_by,
                reason
            ) VALUES (
                assignment.commercial_id,
                new_plan_id,
                effective_at,
                p_actor_id,
                'Actualización de porcentajes del canal económico'
            );
            migrated_assignments := migrated_assignments + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'planId', new_plan_id,
        'version', new_version,
        'effectiveFrom', effective_at,
        'migratedAssignments', migrated_assignments
    );
END;
$$;

ALTER TABLE public.commission_adjustments
    ADD COLUMN contract_id uuid REFERENCES public.contracts(id) ON DELETE RESTRICT,
    ADD COLUMN contract_start_date date,
    ADD COLUMN permanence_end_date date,
    ADD COLUMN termination_date date,
    ADD COLUMN permanence_total_days integer,
    ADD COLUMN permanence_remaining_days integer;

ALTER TABLE public.commission_adjustments
    DROP CONSTRAINT IF EXISTS commission_adjustments_reason_code_check,
    ADD CONSTRAINT commission_adjustments_reason_code_check CHECK (reason_code IN (
        'early_switch', 'non_consolidation', 'non_payment', 'irregular_sale',
        'supplier_correction', 'permanence_breach', 'other'
    )),
    ADD CONSTRAINT commission_adjustments_permanence_snapshot_check CHECK (
        reason_code <> 'permanence_breach'
        OR (
            contract_id IS NOT NULL
            AND contract_start_date IS NOT NULL
            AND permanence_end_date IS NOT NULL
            AND termination_date IS NOT NULL
            AND contract_start_date <= termination_date
            AND termination_date < permanence_end_date
            AND permanence_total_days = permanence_end_date - contract_start_date
            AND permanence_remaining_days = permanence_end_date - termination_date
            AND active_days = termination_date - contract_start_date
            AND permanence_total_days > 0
            AND permanence_remaining_days BETWEEN 1 AND permanence_total_days
        )
    );

CREATE UNIQUE INDEX commission_adjustments_one_open_permanence_idx
    ON public.commission_adjustments (commission_id)
    WHERE reason_code = 'permanence_breach'
      AND status IN ('proposed', 'confirmed');

COMMENT ON COLUMN public.commission_adjustments.termination_date IS
    'Documented date on which the contract stopped before the permanence end date.';
COMMENT ON COLUMN public.commission_adjustments.permanence_remaining_days IS
    'Frozen calendar-day numerator used for the proportional reversal.';

CREATE OR REPLACE FUNCTION public.initialize_commission_lifecycle(p_proposal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    commission public.network_commissions%ROWTYPE;
    proposal public.proposals%ROWTYPE;
    assignment public.commission_plan_assignments%ROWTYPE;
    plan public.commission_plans%ROWTYPE;
    accepted_at timestamptz;
    marketer text;
    product text;
    gross numeric(12,2);
    commercial_amount numeric(12,2);
    franchise_amount numeric(12,2);
    central_amount numeric(12,2);
    proportional_policy jsonb := jsonb_build_object(
        'code', 'proportional_permanence',
        'version', 1,
        'mode', 'remaining_contract_calendar_days',
        'requires_known_permanence', true,
        'customer_penalty_independent', true
    );
BEGIN
    SELECT * INTO proposal FROM public.proposals WHERE id = p_proposal_id FOR UPDATE;
    SELECT * INTO commission FROM public.network_commissions WHERE proposal_id = p_proposal_id FOR UPDATE;

    IF NOT FOUND OR proposal.status <> 'accepted' OR commission.id IS NULL THEN
        RAISE EXCEPTION 'commission initialization unavailable' USING ERRCODE = 'P0002';
    END IF;

    IF commission.plan_snapshot IS NOT NULL THEN
        RETURN commission.id;
    END IF;

    accepted_at := coalesce(proposal.public_accepted_at, proposal.signed_at, proposal.updated_at, proposal.created_at);
    marketer := coalesce(proposal.offer_snapshot->>'marketer_name', proposal.offer_snapshot->>'company');
    product := coalesce(proposal.offer_snapshot->>'product_code', proposal.offer_snapshot->>'tariff_name');

    SELECT a.* INTO assignment
    FROM public.commission_plan_assignments a
    JOIN public.commission_plans candidate ON candidate.id = a.plan_id
    WHERE a.commercial_id = commission.agent_id
      AND a.effective_from <= accepted_at
      AND (a.effective_to IS NULL OR a.effective_to > accepted_at)
      AND candidate.effective_from <= accepted_at
      AND (candidate.effective_to IS NULL OR candidate.effective_to > accepted_at)
    ORDER BY a.effective_from DESC
    LIMIT 1;

    IF assignment.id IS NULL THEN
        UPDATE public.network_commissions
        SET reconciliation_status = 'plan_unassigned',
            client_id = proposal.client_id,
            supply_point_id = proposal.supply_point_id,
            opportunity_id = coalesce(opportunity_id, proposal.opportunity_id)
        WHERE id = commission.id;

        INSERT INTO public.commission_events (
            commission_id, event_type, from_status, to_status, reason_code,
            safe_metadata, idempotency_key
        ) VALUES (
            commission.id, 'reconciliation_required', 'pending', 'pending', 'plan_unassigned',
            jsonb_build_object('proposal_id', proposal.id), 'plan-unassigned'
        ) ON CONFLICT (commission_id, idempotency_key) DO NOTHING;
        RETURN commission.id;
    END IF;

    SELECT * INTO plan FROM public.commission_plans WHERE id = assignment.plan_id;

    IF coalesce(proposal.offer_snapshot->>'estimated_agent_commission', '') !~ '^[0-9]+([.][0-9]+)?$' THEN
        UPDATE public.network_commissions
        SET reconciliation_status = 'pending_review',
            client_id = proposal.client_id,
            supply_point_id = proposal.supply_point_id,
            opportunity_id = coalesce(opportunity_id, proposal.opportunity_id)
        WHERE id = commission.id;
        RETURN commission.id;
    END IF;

    gross := round((proposal.offer_snapshot->>'estimated_agent_commission')::numeric, 2);
    commercial_amount := round(gross * plan.commercial_share_bps / 10000.0, 2);
    franchise_amount := round(gross * plan.franchise_share_bps / 10000.0, 2);
    central_amount := gross - commercial_amount - franchise_amount;

    UPDATE public.network_commissions
    SET commission_plan_id = plan.id,
        decommission_policy_id = NULL,
        client_id = proposal.client_id,
        supply_point_id = proposal.supply_point_id,
        opportunity_id = coalesce(opportunity_id, proposal.opportunity_id),
        gross_supplier_commission = gross,
        commercial_net_amount = commercial_amount,
        franchise_royalty_amount = franchise_amount,
        central_remainder_amount = central_amount,
        agent_commission = commercial_amount,
        franchise_commission = franchise_amount,
        plan_snapshot = jsonb_build_object(
            'id', plan.id, 'code', plan.code, 'version', plan.version, 'channel', plan.channel,
            'commercial_share_bps', plan.commercial_share_bps,
            'franchise_share_bps', plan.franchise_share_bps,
            'central_share_bps', plan.central_share_bps,
            'assignment_id', assignment.id
        ),
        policy_snapshot = proportional_policy,
        calculation_snapshot = jsonb_build_object(
            'source', 'tariff_commissions', 'accepted_at', accepted_at,
            'marketer_name', marketer, 'product_code', product
        ),
        reconciliation_status = 'ready'
    WHERE id = commission.id;

    INSERT INTO public.commission_events (
        commission_id, event_type, from_status, to_status,
        gross_delta, commercial_delta, franchise_delta, central_delta,
        safe_metadata, idempotency_key
    ) VALUES (
        commission.id, 'plan_applied', 'pending', 'pending',
        gross, commercial_amount, franchise_amount, central_amount,
        jsonb_build_object('plan_id', plan.id, 'policy_code', 'proportional_permanence'),
        'plan-applied'
    ) ON CONFLICT (commission_id, idempotency_key) DO NOTHING;

    RETURN commission.id;
END;
$$;

-- Previously unmatched rows can safely adopt the canonical rule because the
-- original allocation is already frozen and remains untouched.
UPDATE public.network_commissions
SET policy_snapshot = jsonb_build_object(
        'code', 'proportional_permanence',
        'version', 1,
        'mode', 'remaining_contract_calendar_days',
        'requires_known_permanence', true,
        'customer_penalty_independent', true
    ),
    decommission_policy_id = NULL,
    reconciliation_status = 'ready'
WHERE reconciliation_status = 'policy_unmatched'
  AND plan_snapshot IS NOT NULL
  AND policy_snapshot IS NULL;

CREATE OR REPLACE FUNCTION public.propose_permanence_decommission(
    p_commission_id uuid,
    p_actor_id uuid,
    p_termination_date date,
    p_evidence_reference text,
    p_supplier_statement_line_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    commission public.network_commissions%ROWTYPE;
    contract public.contracts%ROWTYPE;
    existing_adjustment_id uuid;
    adjustment_id uuid;
    total_days integer;
    active_days integer;
    remaining_days integer;
    reversal_bps integer;
    gross numeric(12,2);
    commercial numeric(12,2);
    franchise numeric(12,2);
    central numeric(12,2);
    adjustment_policy jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'permanence decommission unavailable' USING ERRCODE = '42501';
    END IF;

    IF p_termination_date IS NULL
       OR length(btrim(coalesce(p_evidence_reference, ''))) < 3
    THEN
        RAISE EXCEPTION 'invalid permanence evidence' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO commission
    FROM public.network_commissions
    WHERE id = p_commission_id
    FOR UPDATE;

    IF NOT FOUND
       OR commission.contract_id IS NULL
       OR commission.gross_supplier_commission IS NULL
       OR commission.commercial_net_amount IS NULL
       OR commission.franchise_royalty_amount IS NULL
       OR commission.central_remainder_amount IS NULL
       OR commission.plan_snapshot IS NULL
    THEN
        RAISE EXCEPTION 'commission has no frozen contract allocation' USING ERRCODE = '23514';
    END IF;

    SELECT *
    INTO contract
    FROM public.contracts
    WHERE id = commission.contract_id
    FOR UPDATE;

    IF NOT FOUND
       OR contract.permanence_status <> 'known'
       OR contract.start_date IS NULL
       OR contract.end_date IS NULL
       OR contract.end_date <= contract.start_date
       OR p_termination_date < contract.start_date
       OR p_termination_date >= contract.end_date
    THEN
        RAISE EXCEPTION 'contract has no unfulfilled known permanence' USING ERRCODE = '23514';
    END IF;

    SELECT id
    INTO existing_adjustment_id
    FROM public.commission_adjustments
    WHERE commission_id = commission.id
      AND reason_code = 'permanence_breach'
      AND status IN ('proposed', 'confirmed')
    LIMIT 1;

    IF existing_adjustment_id IS NOT NULL THEN
        RETURN existing_adjustment_id;
    END IF;

    total_days := contract.end_date - contract.start_date;
    active_days := p_termination_date - contract.start_date;
    remaining_days := contract.end_date - p_termination_date;
    reversal_bps := greatest(1, least(10000, round(remaining_days * 10000.0 / total_days)::integer));

    gross := round(commission.gross_supplier_commission * reversal_bps / 10000.0, 2);
    commercial := round(commission.commercial_net_amount * reversal_bps / 10000.0, 2);
    franchise := round(commission.franchise_royalty_amount * reversal_bps / 10000.0, 2);
    central := gross - commercial - franchise;

    IF commission.total_reversed_gross + gross > commission.gross_supplier_commission THEN
        RAISE EXCEPTION 'commission reversal exceeds original amount' USING ERRCODE = '23514';
    END IF;

    adjustment_policy := coalesce(commission.policy_snapshot, '{}'::jsonb) || jsonb_build_object(
        'code', 'proportional_permanence',
        'version', 1,
        'mode', 'remaining_contract_calendar_days',
        'contract_id', contract.id,
        'contract_start_date', contract.start_date,
        'permanence_end_date', contract.end_date,
        'termination_date', p_termination_date,
        'total_days', total_days,
        'active_days', active_days,
        'remaining_days', remaining_days,
        'reversal_bps', reversal_bps,
        'customer_penalty_independent', true
    );

    INSERT INTO public.commission_adjustments (
        commission_id,
        supplier_statement_line_id,
        contract_id,
        reason_code,
        active_days,
        reversal_bps,
        gross_amount,
        commercial_amount,
        franchise_amount,
        central_amount,
        evidence_reference,
        policy_snapshot,
        proposed_by,
        contract_start_date,
        permanence_end_date,
        termination_date,
        permanence_total_days,
        permanence_remaining_days
    ) VALUES (
        commission.id,
        p_supplier_statement_line_id,
        contract.id,
        'permanence_breach',
        active_days,
        reversal_bps,
        gross,
        commercial,
        franchise,
        central,
        btrim(p_evidence_reference),
        adjustment_policy,
        p_actor_id,
        contract.start_date,
        contract.end_date,
        p_termination_date,
        total_days,
        remaining_days
    )
    RETURNING id INTO adjustment_id;

    INSERT INTO public.commission_events (
        commission_id,
        event_type,
        from_status,
        to_status,
        actor_id,
        reason_code,
        evidence_reference,
        safe_metadata,
        idempotency_key
    ) VALUES (
        commission.id,
        'adjustment_proposed',
        commission.lifecycle_status,
        commission.lifecycle_status,
        p_actor_id,
        'permanence_breach',
        btrim(p_evidence_reference),
        jsonb_build_object(
            'adjustment_id', adjustment_id,
            'contract_id', contract.id,
            'active_days', active_days,
            'remaining_days', remaining_days,
            'total_days', total_days,
            'reversal_bps', reversal_bps
        ),
        'permanence-adjustment:' || adjustment_id::text
    );

    RETURN adjustment_id;
END;
$$;

CREATE OR REPLACE VIEW public.commission_reconciliation_queue
WITH (security_invoker = true, security_barrier = true) AS
SELECT
    commission.id AS commission_id,
    commission.proposal_id,
    commission.opportunity_id,
    commission.agent_id AS commercial_id,
    commission.franchise_id,
    commission.lifecycle_status,
    commission.reconciliation_status,
    commission.created_at,
    CASE commission.reconciliation_status
        WHEN 'plan_unassigned' THEN 'Asignar plan económico'
        WHEN 'policy_unmatched' THEN 'Revisar política histórica de decomisión'
        WHEN 'contradictory_legacy' THEN 'Revisar estado histórico contradictorio'
        ELSE 'Revisar cálculo económico'
    END AS required_action
FROM public.network_commissions commission
WHERE commission.reconciliation_status <> 'ready';

REVOKE ALL ON FUNCTION public.version_commission_plan(uuid,text,text,integer,integer)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.propose_permanence_decommission(uuid,uuid,date,text,uuid)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.version_commission_plan(uuid,text,text,integer,integer)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.propose_permanence_decommission(uuid,uuid,date,text,uuid)
    TO service_role;

COMMIT;

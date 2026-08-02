BEGIN;

CREATE TABLE public.commission_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL,
    version integer NOT NULL CHECK (version > 0),
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
    channel text NOT NULL CHECK (channel IN ('partner_direct', 'franchise_network')),
    commercial_share_bps integer NOT NULL CHECK (commercial_share_bps BETWEEN 0 AND 10000),
    franchise_share_bps integer NOT NULL CHECK (franchise_share_bps BETWEEN 0 AND 10000),
    central_share_bps integer NOT NULL CHECK (central_share_bps BETWEEN 0 AND 10000),
    effective_from timestamptz NOT NULL,
    effective_to timestamptz,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT commission_plans_code_version_key UNIQUE (code, version),
    CONSTRAINT commission_plans_balanced_check CHECK (
        commercial_share_bps + franchise_share_bps + central_share_bps = 10000
    ),
    CONSTRAINT commission_plans_direct_franchise_check CHECK (
        channel <> 'partner_direct' OR franchise_share_bps = 0
    ),
    CONSTRAINT commission_plans_effective_range_check CHECK (
        effective_to IS NULL OR effective_to > effective_from
    )
);

CREATE TABLE public.commission_plan_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commercial_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    plan_id uuid NOT NULL REFERENCES public.commission_plans(id) ON DELETE RESTRICT,
    effective_from timestamptz NOT NULL,
    effective_to timestamptz,
    assigned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT commission_plan_assignments_no_self_check CHECK (assigned_by <> commercial_id),
    CONSTRAINT commission_plan_assignments_range_check CHECK (
        effective_to IS NULL OR effective_to > effective_from
    )
);

CREATE UNIQUE INDEX commission_plan_assignments_one_current_idx
    ON public.commission_plan_assignments (commercial_id)
    WHERE effective_to IS NULL;

CREATE INDEX commission_plan_assignments_lookup_idx
    ON public.commission_plan_assignments (commercial_id, effective_from DESC, effective_to);

CREATE TABLE public.commission_decommission_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL,
    version integer NOT NULL CHECK (version > 0),
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
    marketer_name text NOT NULL CHECK (length(btrim(marketer_name)) BETWEEN 1 AND 120),
    product_code text,
    consolidation_days integer NOT NULL DEFAULT 0 CHECK (consolidation_days >= 0),
    clawback_days integer NOT NULL CHECK (clawback_days >= consolidation_days),
    effective_from timestamptz NOT NULL,
    effective_to timestamptz,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT commission_decommission_policies_code_version_key UNIQUE (code, version),
    CONSTRAINT commission_decommission_policies_range_check CHECK (
        effective_to IS NULL OR effective_to > effective_from
    )
);

CREATE INDEX commission_decommission_policies_lookup_idx
    ON public.commission_decommission_policies (lower(marketer_name), product_code, effective_from DESC)
    WHERE is_active;

CREATE TABLE public.commission_decommission_bands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid NOT NULL REFERENCES public.commission_decommission_policies(id) ON DELETE RESTRICT,
    active_day_from integer NOT NULL CHECK (active_day_from >= 0),
    active_day_to integer CHECK (active_day_to IS NULL OR active_day_to >= active_day_from),
    reversal_bps integer NOT NULL CHECK (reversal_bps BETWEEN 0 AND 10000),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT commission_decommission_bands_unique_start UNIQUE (policy_id, active_day_from)
);

CREATE OR REPLACE FUNCTION private.guard_decommission_band()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'decommission policy bands are immutable; create a new policy version'
            USING ERRCODE = '55000';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.commission_decommission_bands existing
        WHERE existing.policy_id = NEW.policy_id
          AND int8range(existing.active_day_from, coalesce(existing.active_day_to::bigint + 1, 2147483648), '[)')
              && int8range(NEW.active_day_from, coalesce(NEW.active_day_to::bigint + 1, 2147483648), '[)')
    ) THEN
        RAISE EXCEPTION 'decommission policy bands cannot overlap' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_decommission_band_insert
    BEFORE INSERT ON public.commission_decommission_bands
    FOR EACH ROW EXECUTE FUNCTION private.guard_decommission_band();

CREATE TRIGGER guard_decommission_band_mutation
    BEFORE UPDATE OR DELETE ON public.commission_decommission_bands
    FOR EACH ROW EXECUTE FUNCTION private.guard_decommission_band();

CREATE TABLE public.commission_supplier_statements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_name text NOT NULL CHECK (length(btrim(marketer_name)) BETWEEN 1 AND 120),
    statement_reference text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL CHECK (period_end >= period_start),
    received_at timestamptz NOT NULL DEFAULT now(),
    imported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    source_file_reference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT commission_supplier_statements_reference_key UNIQUE (marketer_name, statement_reference)
);

CREATE TABLE public.commission_supplier_statement_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id uuid NOT NULL REFERENCES public.commission_supplier_statements(id) ON DELETE RESTRICT,
    source_line_key text NOT NULL,
    proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
    contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
    gross_amount numeric(12,2),
    event_kind text NOT NULL CHECK (event_kind IN (
        'consolidated', 'early_switch', 'non_consolidation', 'non_payment',
        'irregular_sale', 'supplier_correction', 'other'
    )),
    evidence_reference text,
    raw_safe_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT commission_supplier_statement_lines_source_key UNIQUE (statement_id, source_line_key)
);

ALTER TABLE public.network_commissions
    ADD COLUMN lifecycle_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN commission_plan_id uuid REFERENCES public.commission_plans(id) ON DELETE RESTRICT,
    ADD COLUMN decommission_policy_id uuid REFERENCES public.commission_decommission_policies(id) ON DELETE RESTRICT,
    ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT,
    ADD COLUMN supply_point_id uuid REFERENCES public.supply_points(id) ON DELETE RESTRICT,
    ADD COLUMN contract_id uuid REFERENCES public.contracts(id) ON DELETE RESTRICT,
    ADD COLUMN supplier_statement_line_id uuid REFERENCES public.commission_supplier_statement_lines(id) ON DELETE SET NULL,
    ADD COLUMN gross_supplier_commission numeric(12,2),
    ADD COLUMN commercial_net_amount numeric(12,2),
    ADD COLUMN franchise_royalty_amount numeric(12,2),
    ADD COLUMN central_remainder_amount numeric(12,2),
    ADD COLUMN total_reversed_gross numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN total_reversed_commercial numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN total_reversed_franchise numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN total_reversed_central numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN plan_snapshot jsonb,
    ADD COLUMN policy_snapshot jsonb,
    ADD COLUMN calculation_snapshot jsonb,
    ADD COLUMN reconciliation_status text NOT NULL DEFAULT 'pending_review',
    ADD COLUMN eligible_at timestamptz,
    ADD COLUMN validated_at timestamptz,
    ADD COLUMN validated_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD COLUMN lifecycle_invoiced_at timestamptz,
    ADD COLUMN lifecycle_paid_at timestamptz,
    ADD COLUMN reverted_at timestamptz,
    ADD CONSTRAINT network_commissions_lifecycle_status_check CHECK (
        lifecycle_status IN ('pending', 'eligible', 'validated', 'invoiced', 'paid', 'reverted')
    ),
    ADD CONSTRAINT network_commissions_reconciliation_status_check CHECK (
        reconciliation_status IN ('ready', 'plan_unassigned', 'policy_unmatched', 'pending_review', 'contradictory_legacy')
    ),
    ADD CONSTRAINT network_commissions_allocation_nonnegative_check CHECK (
        coalesce(gross_supplier_commission, 0) >= 0
        AND coalesce(commercial_net_amount, 0) >= 0
        AND coalesce(franchise_royalty_amount, 0) >= 0
        AND coalesce(central_remainder_amount, 0) >= 0
        AND total_reversed_gross >= 0
        AND total_reversed_commercial >= 0
        AND total_reversed_franchise >= 0
        AND total_reversed_central >= 0
    ),
    ADD CONSTRAINT network_commissions_allocation_balanced_check CHECK (
        gross_supplier_commission IS NULL OR (
            commercial_net_amount IS NOT NULL
            AND franchise_royalty_amount IS NOT NULL
            AND central_remainder_amount IS NOT NULL
            AND gross_supplier_commission = commercial_net_amount + franchise_royalty_amount + central_remainder_amount
        )
    ),
    ADD CONSTRAINT network_commissions_reversal_balanced_check CHECK (
        total_reversed_gross = total_reversed_commercial + total_reversed_franchise + total_reversed_central
    ),
    ADD CONSTRAINT network_commissions_reversal_limit_check CHECK (
        gross_supplier_commission IS NULL OR total_reversed_gross <= gross_supplier_commission
    );

CREATE INDEX network_commissions_lifecycle_queue_idx
    ON public.network_commissions (lifecycle_status, created_at)
    WHERE lifecycle_status <> 'paid';

CREATE INDEX network_commissions_reconciliation_idx
    ON public.network_commissions (reconciliation_status, created_at)
    WHERE reconciliation_status <> 'ready';

CREATE TABLE public.commission_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id uuid NOT NULL REFERENCES public.network_commissions(id) ON DELETE RESTRICT,
    event_type text NOT NULL CHECK (event_type IN (
        'created', 'plan_applied', 'eligible', 'validated', 'invoiced', 'paid',
        'adjustment_proposed', 'adjustment_confirmed', 'adjustment_disputed',
        'adjustment_waived', 'reverted', 'reconciliation_required'
    )),
    from_status text,
    to_status text,
    actor_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
    gross_delta numeric(12,2) NOT NULL DEFAULT 0,
    commercial_delta numeric(12,2) NOT NULL DEFAULT 0,
    franchise_delta numeric(12,2) NOT NULL DEFAULT 0,
    central_delta numeric(12,2) NOT NULL DEFAULT 0,
    reason_code text,
    evidence_reference text,
    safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT commission_events_idempotency_key UNIQUE (commission_id, idempotency_key),
    CONSTRAINT commission_events_balanced_delta_check CHECK (
        gross_delta = commercial_delta + franchise_delta + central_delta
    )
);

CREATE INDEX commission_events_commission_created_idx
    ON public.commission_events (commission_id, created_at, id);

CREATE TABLE public.commission_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id uuid NOT NULL REFERENCES public.network_commissions(id) ON DELETE RESTRICT,
    supplier_statement_line_id uuid REFERENCES public.commission_supplier_statement_lines(id) ON DELETE SET NULL,
    reason_code text NOT NULL CHECK (reason_code IN (
        'early_switch', 'non_consolidation', 'non_payment', 'irregular_sale',
        'supplier_correction', 'other'
    )),
    status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'disputed', 'waived')),
    active_days integer CHECK (active_days IS NULL OR active_days >= 0),
    reversal_bps integer NOT NULL CHECK (reversal_bps BETWEEN 1 AND 10000),
    gross_amount numeric(12,2) NOT NULL CHECK (gross_amount > 0),
    commercial_amount numeric(12,2) NOT NULL CHECK (commercial_amount >= 0),
    franchise_amount numeric(12,2) NOT NULL CHECK (franchise_amount >= 0),
    central_amount numeric(12,2) NOT NULL CHECK (central_amount >= 0),
    evidence_reference text NOT NULL CHECK (length(btrim(evidence_reference)) BETWEEN 3 AND 500),
    policy_snapshot jsonb NOT NULL,
    proposed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    proposed_at timestamptz NOT NULL DEFAULT now(),
    resolved_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
    resolved_at timestamptz,
    resolution_note text,
    CONSTRAINT commission_adjustments_balanced_check CHECK (
        gross_amount = commercial_amount + franchise_amount + central_amount
    )
);

CREATE UNIQUE INDEX commission_adjustments_statement_line_idx
    ON public.commission_adjustments (supplier_statement_line_id)
    WHERE supplier_statement_line_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.prevent_commission_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'commission ledger records are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER prevent_commission_events_mutation
    BEFORE UPDATE OR DELETE ON public.commission_events
    FOR EACH ROW EXECUTE FUNCTION private.prevent_commission_ledger_mutation();

CREATE OR REPLACE FUNCTION private.prevent_frozen_commission_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF OLD.plan_snapshot IS NOT NULL AND (
        NEW.commission_plan_id IS DISTINCT FROM OLD.commission_plan_id
        OR NEW.gross_supplier_commission IS DISTINCT FROM OLD.gross_supplier_commission
        OR NEW.commercial_net_amount IS DISTINCT FROM OLD.commercial_net_amount
        OR NEW.franchise_royalty_amount IS DISTINCT FROM OLD.franchise_royalty_amount
        OR NEW.central_remainder_amount IS DISTINCT FROM OLD.central_remainder_amount
        OR NEW.plan_snapshot IS DISTINCT FROM OLD.plan_snapshot
        OR NEW.calculation_snapshot IS DISTINCT FROM OLD.calculation_snapshot
    ) THEN
        RAISE EXCEPTION 'frozen commission allocation cannot be changed' USING ERRCODE = '55000';
    END IF;

    IF OLD.policy_snapshot IS NOT NULL AND (
        NEW.decommission_policy_id IS DISTINCT FROM OLD.decommission_policy_id
        OR NEW.policy_snapshot IS DISTINCT FROM OLD.policy_snapshot
    ) THEN
        RAISE EXCEPTION 'frozen decommission policy cannot be changed' USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_frozen_commission_change
    BEFORE UPDATE ON public.network_commissions
    FOR EACH ROW EXECUTE FUNCTION private.prevent_frozen_commission_change();

CREATE OR REPLACE FUNCTION public.assign_commission_plan(
    p_commercial_id uuid,
    p_plan_id uuid,
    p_actor_id uuid,
    p_reason text,
    p_effective_from timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    assignment_id uuid;
BEGIN
    IF p_actor_id = p_commercial_id OR NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'commission plan assignment unavailable' USING ERRCODE = '42501';
    END IF;

    IF length(btrim(coalesce(p_reason, ''))) < 3
       OR NOT EXISTS (SELECT 1 FROM public.commission_plans WHERE id = p_plan_id AND is_active)
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_commercial_id)
    THEN
        RAISE EXCEPTION 'invalid commission plan assignment' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_commercial_id::text, 0));

    IF EXISTS (
        SELECT 1
        FROM public.commission_plan_assignments
        WHERE commercial_id = p_commercial_id
          AND effective_to IS NULL
          AND effective_from >= p_effective_from
    ) THEN
        RAISE EXCEPTION 'new assignment must start after the current assignment' USING ERRCODE = '23514';
    END IF;

    UPDATE public.commission_plan_assignments
    SET effective_to = p_effective_from
    WHERE commercial_id = p_commercial_id
      AND effective_to IS NULL
      AND effective_from < p_effective_from;

    INSERT INTO public.commission_plan_assignments (
        commercial_id, plan_id, effective_from, assigned_by, reason
    ) VALUES (
        p_commercial_id, p_plan_id, p_effective_from, p_actor_id, btrim(p_reason)
    )
    RETURNING id INTO assignment_id;

    RETURN assignment_id;
END;
$$;

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
    policy public.commission_decommission_policies%ROWTYPE;
    accepted_at timestamptz;
    marketer text;
    product text;
    gross numeric(12,2);
    commercial_amount numeric(12,2);
    franchise_amount numeric(12,2);
    central_amount numeric(12,2);
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
      AND candidate.is_active
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

    SELECT candidate.* INTO policy
    FROM public.commission_decommission_policies candidate
    WHERE candidate.is_active
      AND lower(candidate.marketer_name) = lower(marketer)
      AND (candidate.product_code IS NULL OR candidate.product_code = product)
      AND candidate.effective_from <= accepted_at
      AND (candidate.effective_to IS NULL OR candidate.effective_to > accepted_at)
    ORDER BY (candidate.product_code IS NOT NULL) DESC, candidate.effective_from DESC
    LIMIT 1;

    UPDATE public.network_commissions
    SET commission_plan_id = plan.id,
        decommission_policy_id = policy.id,
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
        policy_snapshot = CASE WHEN policy.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', policy.id, 'code', policy.code, 'version', policy.version,
            'marketer_name', policy.marketer_name, 'product_code', policy.product_code,
            'consolidation_days', policy.consolidation_days, 'clawback_days', policy.clawback_days,
            'bands', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                    'active_day_from', band.active_day_from,
                    'active_day_to', band.active_day_to,
                    'reversal_bps', band.reversal_bps
                ) ORDER BY band.active_day_from)
                FROM public.commission_decommission_bands band
                WHERE band.policy_id = policy.id
            ), '[]'::jsonb)
        ) END,
        calculation_snapshot = jsonb_build_object(
            'source', 'tariff_commissions', 'accepted_at', accepted_at,
            'marketer_name', marketer, 'product_code', product
        ),
        reconciliation_status = CASE WHEN policy.id IS NULL THEN 'policy_unmatched' ELSE 'ready' END
    WHERE id = commission.id;

    INSERT INTO public.commission_events (
        commission_id, event_type, from_status, to_status,
        gross_delta, commercial_delta, franchise_delta, central_delta,
        safe_metadata, idempotency_key
    ) VALUES (
        commission.id, 'plan_applied', 'pending', 'pending',
        gross, commercial_amount, franchise_amount, central_amount,
        jsonb_build_object('plan_id', plan.id, 'policy_id', policy.id), 'plan-applied'
    ) ON CONFLICT (commission_id, idempotency_key) DO NOTHING;

    RETURN commission.id;
END;
$$;

CREATE OR REPLACE FUNCTION private.mark_commission_eligible_on_contract_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    commission_id uuid;
BEGIN
    IF NEW.status <> 'active' OR NEW.proposal_id IS NULL THEN
        RETURN NEW;
    END IF;

    UPDATE public.network_commissions
    SET lifecycle_status = 'eligible',
        contract_id = NEW.id,
        client_id = NEW.client_id,
        supply_point_id = NEW.supply_point_id,
        eligible_at = coalesce(eligible_at, clock_timestamp())
    WHERE proposal_id = NEW.proposal_id
      AND lifecycle_status = 'pending'
    RETURNING id INTO commission_id;

    IF commission_id IS NOT NULL THEN
        INSERT INTO public.commission_events (
            commission_id, event_type, from_status, to_status, safe_metadata, idempotency_key
        ) VALUES (
            commission_id, 'eligible', 'pending', 'eligible',
            jsonb_build_object('contract_id', NEW.id), 'contract-eligible:' || NEW.id::text
        ) ON CONFLICT (commission_id, idempotency_key) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER mark_commission_eligible_on_contract_activation
    AFTER INSERT OR UPDATE OF status ON public.contracts
    FOR EACH ROW EXECUTE FUNCTION private.mark_commission_eligible_on_contract_activation();

CREATE OR REPLACE FUNCTION public.transition_commission_lifecycle(
    p_commission_id uuid,
    p_to_status text,
    p_actor_id uuid,
    p_reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    commission public.network_commissions%ROWTYPE;
    allowed boolean := false;
    transition_at timestamptz := clock_timestamp();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin')
       OR length(btrim(coalesce(p_reason, ''))) < 3
    THEN
        RAISE EXCEPTION 'commission transition unavailable' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO commission FROM public.network_commissions WHERE id = p_commission_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'commission not found' USING ERRCODE = 'P0002';
    END IF;

    allowed := (commission.lifecycle_status = 'eligible' AND p_to_status = 'validated')
        OR (commission.lifecycle_status = 'validated' AND p_to_status = 'invoiced')
        OR (commission.lifecycle_status = 'invoiced' AND p_to_status = 'paid');

    IF NOT allowed THEN
        RAISE EXCEPTION 'invalid commission lifecycle transition' USING ERRCODE = '23514';
    END IF;

    IF p_to_status IN ('validated', 'invoiced', 'paid')
       AND (commission.reconciliation_status <> 'ready' OR commission.plan_snapshot IS NULL)
    THEN
        RAISE EXCEPTION 'commission requires reconciliation' USING ERRCODE = '23514';
    END IF;

    UPDATE public.network_commissions
    SET lifecycle_status = p_to_status,
        status = CASE
            WHEN p_to_status = 'validated' THEN 'cleared'
            WHEN p_to_status = 'paid' THEN 'paid'
            ELSE status
        END,
        invoiced = CASE WHEN p_to_status = 'invoiced' THEN true ELSE invoiced END,
        validated_at = CASE WHEN p_to_status = 'validated' THEN transition_at ELSE validated_at END,
        validated_by = CASE WHEN p_to_status = 'validated' THEN p_actor_id ELSE validated_by END,
        lifecycle_invoiced_at = CASE WHEN p_to_status = 'invoiced' THEN transition_at ELSE lifecycle_invoiced_at END,
        lifecycle_paid_at = CASE WHEN p_to_status = 'paid' THEN transition_at ELSE lifecycle_paid_at END,
        paid_date = CASE WHEN p_to_status = 'paid' THEN transition_at::date ELSE paid_date END
    WHERE id = commission.id;

    INSERT INTO public.commission_events (
        commission_id, event_type, from_status, to_status, actor_id,
        reason_code, idempotency_key
    ) VALUES (
        commission.id, p_to_status, commission.lifecycle_status, p_to_status, p_actor_id,
        btrim(p_reason), p_to_status || ':' || transition_at::text
    );

    RETURN p_to_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.propose_commission_adjustment(
    p_commission_id uuid,
    p_actor_id uuid,
    p_reason_code text,
    p_reversal_bps integer,
    p_active_days integer,
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
    adjustment_id uuid;
    gross numeric(12,2);
    commercial numeric(12,2);
    franchise numeric(12,2);
    central numeric(12,2);
    expected_reversal_bps integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin') THEN
        RAISE EXCEPTION 'commission adjustment unavailable' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO commission FROM public.network_commissions WHERE id = p_commission_id FOR UPDATE;
    IF NOT FOUND OR commission.gross_supplier_commission IS NULL OR commission.policy_snapshot IS NULL
       OR p_reason_code NOT IN ('early_switch', 'non_consolidation', 'non_payment', 'irregular_sale', 'supplier_correction', 'other')
       OR p_reversal_bps NOT BETWEEN 1 AND 10000
       OR length(btrim(coalesce(p_evidence_reference, ''))) < 3
    THEN
        RAISE EXCEPTION 'invalid commission adjustment' USING ERRCODE = '22023';
    END IF;

    IF p_reason_code NOT IN ('supplier_correction', 'other') THEN
        IF p_active_days IS NULL THEN
            RAISE EXCEPTION 'active days are required by the frozen decommission policy'
                USING ERRCODE = '22023';
        END IF;

        SELECT band.reversal_bps INTO expected_reversal_bps
        FROM public.commission_decommission_bands band
        WHERE band.policy_id = commission.decommission_policy_id
          AND p_active_days >= band.active_day_from
          AND (band.active_day_to IS NULL OR p_active_days <= band.active_day_to)
        ORDER BY band.active_day_from DESC
        LIMIT 1;

        IF expected_reversal_bps IS NULL OR expected_reversal_bps <> p_reversal_bps THEN
            RAISE EXCEPTION 'reversal does not match the frozen decommission policy'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    gross := round(commission.gross_supplier_commission * p_reversal_bps / 10000.0, 2);
    commercial := round(commission.commercial_net_amount * p_reversal_bps / 10000.0, 2);
    franchise := round(commission.franchise_royalty_amount * p_reversal_bps / 10000.0, 2);
    central := gross - commercial - franchise;

    IF commission.total_reversed_gross + gross > commission.gross_supplier_commission THEN
        RAISE EXCEPTION 'commission reversal exceeds original amount' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.commission_adjustments (
        commission_id, supplier_statement_line_id, reason_code, active_days,
        reversal_bps, gross_amount, commercial_amount, franchise_amount, central_amount,
        evidence_reference, policy_snapshot, proposed_by
    ) VALUES (
        commission.id, p_supplier_statement_line_id, p_reason_code, p_active_days,
        p_reversal_bps, gross, commercial, franchise, central,
        btrim(p_evidence_reference), commission.policy_snapshot, p_actor_id
    ) RETURNING id INTO adjustment_id;

    INSERT INTO public.commission_events (
        commission_id, event_type, from_status, to_status, actor_id,
        reason_code, evidence_reference, safe_metadata, idempotency_key
    ) VALUES (
        commission.id, 'adjustment_proposed', commission.lifecycle_status, commission.lifecycle_status,
        p_actor_id, p_reason_code, btrim(p_evidence_reference),
        jsonb_build_object('adjustment_id', adjustment_id, 'active_days', p_active_days),
        'adjustment-proposed:' || adjustment_id::text
    );

    RETURN adjustment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_commission_adjustment(
    p_adjustment_id uuid,
    p_actor_id uuid,
    p_resolution text,
    p_note text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    adjustment public.commission_adjustments%ROWTYPE;
    commission public.network_commissions%ROWTYPE;
    event_name text;
    transition_at timestamptz := clock_timestamp();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin')
       OR p_resolution NOT IN ('confirmed', 'disputed', 'waived')
       OR length(btrim(coalesce(p_note, ''))) < 3
    THEN
        RAISE EXCEPTION 'commission adjustment resolution unavailable' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO adjustment FROM public.commission_adjustments WHERE id = p_adjustment_id FOR UPDATE;
    IF NOT FOUND OR adjustment.status <> 'proposed' THEN
        RAISE EXCEPTION 'commission adjustment unavailable' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO commission FROM public.network_commissions WHERE id = adjustment.commission_id FOR UPDATE;

    UPDATE public.commission_adjustments
    SET status = p_resolution, resolved_by = p_actor_id, resolved_at = transition_at,
        resolution_note = btrim(p_note)
    WHERE id = adjustment.id;

    IF p_resolution = 'confirmed' THEN
        UPDATE public.network_commissions
        SET total_reversed_gross = total_reversed_gross + adjustment.gross_amount,
            total_reversed_commercial = total_reversed_commercial + adjustment.commercial_amount,
            total_reversed_franchise = total_reversed_franchise + adjustment.franchise_amount,
            total_reversed_central = total_reversed_central + adjustment.central_amount,
            lifecycle_status = CASE
                WHEN total_reversed_gross + adjustment.gross_amount = gross_supplier_commission THEN 'reverted'
                ELSE lifecycle_status
            END,
            reverted_at = CASE
                WHEN total_reversed_gross + adjustment.gross_amount = gross_supplier_commission THEN transition_at
                ELSE reverted_at
            END,
            status = CASE
                WHEN total_reversed_gross + adjustment.gross_amount = gross_supplier_commission THEN 'rejected'
                ELSE status
            END
        WHERE id = commission.id;
        event_name := CASE
            WHEN commission.total_reversed_gross + adjustment.gross_amount = commission.gross_supplier_commission
                THEN 'reverted'
            ELSE 'adjustment_confirmed'
        END;
    ELSE
        event_name := 'adjustment_' || p_resolution;
    END IF;

    INSERT INTO public.commission_events (
        commission_id, event_type, from_status, to_status, actor_id,
        gross_delta, commercial_delta, franchise_delta, central_delta,
        reason_code, evidence_reference, safe_metadata, idempotency_key
    ) VALUES (
        commission.id, event_name, commission.lifecycle_status,
        CASE WHEN event_name = 'reverted' THEN 'reverted' ELSE commission.lifecycle_status END,
        p_actor_id,
        CASE WHEN p_resolution = 'confirmed' THEN -adjustment.gross_amount ELSE 0 END,
        CASE WHEN p_resolution = 'confirmed' THEN -adjustment.commercial_amount ELSE 0 END,
        CASE WHEN p_resolution = 'confirmed' THEN -adjustment.franchise_amount ELSE 0 END,
        CASE WHEN p_resolution = 'confirmed' THEN -adjustment.central_amount ELSE 0 END,
        adjustment.reason_code, adjustment.evidence_reference,
        jsonb_build_object('adjustment_id', adjustment.id, 'resolution_note', btrim(p_note)),
        'adjustment-resolved:' || adjustment.id::text
    );

    RETURN p_resolution;
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
        WHEN 'policy_unmatched' THEN 'Asignar política de decomisión'
        WHEN 'contradictory_legacy' THEN 'Revisar estado histórico contradictorio'
        ELSE 'Revisar cálculo económico'
    END AS required_action
FROM public.network_commissions commission
WHERE commission.reconciliation_status <> 'ready';

ALTER TABLE public.commission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_decommission_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_decommission_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_supplier_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_supplier_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_plans_authenticated_read ON public.commission_plans
    FOR SELECT TO authenticated USING (true);
CREATE POLICY commission_policies_authenticated_read ON public.commission_decommission_policies
    FOR SELECT TO authenticated USING (true);
CREATE POLICY commission_policy_bands_authenticated_read ON public.commission_decommission_bands
    FOR SELECT TO authenticated USING (true);
CREATE POLICY commission_assignments_scoped_read ON public.commission_plan_assignments
    FOR SELECT TO authenticated USING (
        commercial_id = (select auth.uid()) OR (select private.is_admin())
    );
CREATE POLICY commission_events_scoped_read ON public.commission_events
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.network_commissions commission
            WHERE commission.id = commission_events.commission_id
              AND (
                  commission.agent_id = (select auth.uid())
                  OR commission.franchise_id = (select auth.uid())
                  OR (select private.is_admin())
              )
        )
    );
CREATE POLICY commission_adjustments_scoped_read ON public.commission_adjustments
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.network_commissions commission
            WHERE commission.id = commission_adjustments.commission_id
              AND (
                  commission.agent_id = (select auth.uid())
                  OR commission.franchise_id = (select auth.uid())
                  OR (select private.is_admin())
              )
        )
    );
CREATE POLICY commission_supplier_statements_admin_read ON public.commission_supplier_statements
    FOR SELECT TO authenticated USING ((select private.is_admin()));
CREATE POLICY commission_supplier_lines_admin_read ON public.commission_supplier_statement_lines
    FOR SELECT TO authenticated USING ((select private.is_admin()));

REVOKE ALL ON public.commission_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_plan_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_decommission_policies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_decommission_bands FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_supplier_statements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_supplier_statement_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_adjustments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_reconciliation_queue FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.commission_plans TO authenticated, service_role;
GRANT SELECT ON public.commission_plan_assignments TO authenticated, service_role;
GRANT SELECT ON public.commission_decommission_policies TO authenticated, service_role;
GRANT SELECT ON public.commission_decommission_bands TO authenticated, service_role;
GRANT SELECT ON public.commission_supplier_statements TO authenticated, service_role;
GRANT SELECT ON public.commission_supplier_statement_lines TO authenticated, service_role;
GRANT SELECT ON public.commission_events TO authenticated, service_role;
GRANT SELECT ON public.commission_adjustments TO authenticated, service_role;
GRANT SELECT ON public.commission_reconciliation_queue TO authenticated, service_role;
GRANT ALL ON public.commission_plans TO service_role;
GRANT ALL ON public.commission_plan_assignments TO service_role;
GRANT ALL ON public.commission_decommission_policies TO service_role;
GRANT ALL ON public.commission_decommission_bands TO service_role;
GRANT ALL ON public.commission_supplier_statements TO service_role;
GRANT ALL ON public.commission_supplier_statement_lines TO service_role;
GRANT ALL ON public.commission_events TO service_role;
GRANT ALL ON public.commission_adjustments TO service_role;

REVOKE ALL ON FUNCTION public.assign_commission_plan(uuid,uuid,uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.initialize_commission_lifecycle(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_commission_lifecycle(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.propose_commission_adjustment(uuid,uuid,text,integer,integer,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_commission_adjustment(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_decommission_band() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_commission_ledger_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_frozen_commission_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.mark_commission_eligible_on_contract_activation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_commission_plan(uuid,uuid,uuid,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.initialize_commission_lifecycle(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_commission_lifecycle(uuid,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.propose_commission_adjustment(uuid,uuid,text,integer,integer,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_commission_adjustment(uuid,uuid,text,text) TO service_role;

-- Historical rows retain their original approved amounts. Only deterministic
-- status facts are copied; economic contradictions remain reviewable.
UPDATE public.network_commissions
SET lifecycle_status = CASE
        WHEN status = 'paid' THEN 'paid'
        WHEN invoiced IS TRUE THEN 'invoiced'
        WHEN status IN ('approved', 'cleared') THEN 'validated'
        ELSE 'pending'
    END,
    lifecycle_invoiced_at = CASE WHEN invoiced IS TRUE THEN created_at ELSE NULL END,
    lifecycle_paid_at = CASE WHEN status = 'paid' THEN coalesce(paid_date::timestamptz, created_at) ELSE NULL END,
    reconciliation_status = CASE
        WHEN status = 'paid' AND invoiced IS NOT TRUE THEN 'contradictory_legacy'
        WHEN status = 'rejected' THEN 'contradictory_legacy'
        ELSE 'pending_review'
    END;

UPDATE public.network_commissions commission
SET lifecycle_status = 'eligible',
    contract_id = contract.id,
    client_id = coalesce(commission.client_id, contract.client_id),
    supply_point_id = coalesce(commission.supply_point_id, contract.supply_point_id),
    eligible_at = coalesce(contract.start_date::timestamptz, contract.created_at, commission.created_at)
FROM public.contracts contract
WHERE contract.proposal_id = commission.proposal_id
  AND contract.status = 'active'
  AND commission.lifecycle_status = 'pending'
  AND commission.status = 'pending';

INSERT INTO public.commission_events (
    commission_id, event_type, from_status, to_status, reason_code,
    safe_metadata, idempotency_key
)
SELECT
    id, 'reconciliation_required', lifecycle_status, lifecycle_status,
    reconciliation_status, jsonb_build_object('legacy_status', status, 'legacy_invoiced', invoiced),
    'legacy-reconciliation'
FROM public.network_commissions
ON CONFLICT (commission_id, idempotency_key) DO NOTHING;

COMMENT ON TABLE public.commission_plans IS
    'Versioned Zinergia economic plans. Percentages are business data and never inferred from auth roles.';
COMMENT ON TABLE public.commission_events IS
    'Append-only commission ledger; corrections are new events, never overwrites.';
COMMENT ON COLUMN public.network_commissions.gross_supplier_commission IS
    'Gross commission owed by the marketer before Zinergia allocation.';
COMMENT ON COLUMN public.network_commissions.lifecycle_status IS
    'Canonical lifecycle: pending, eligible, validated, invoiced, paid or fully reverted.';

COMMIT;

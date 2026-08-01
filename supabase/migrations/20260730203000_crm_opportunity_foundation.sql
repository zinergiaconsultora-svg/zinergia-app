-- Professional CRM opportunity foundation.
-- Additive only: legacy lead, renewal and task records remain available during rollout.

CREATE TABLE public.opportunities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    supply_point_id uuid NOT NULL,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
    type text NOT NULL,
    stage text NOT NULL DEFAULT 'invoice_received',
    source text,
    stage_entered_at timestamptz NOT NULL DEFAULT now(),
    next_action_type text,
    next_action_title text,
    next_action_due_at timestamptz,
    expected_close_date date,
    source_contract_id uuid REFERENCES public.contracts(id) ON DELETE RESTRICT,
    won_at timestamptz,
    lost_at timestamptz,
    loss_reason text,
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT opportunities_id_client_key UNIQUE (id, client_id),
    CONSTRAINT opportunities_type_check
        CHECK (type IN ('new_business', 'switch', 'renewal')),
    CONSTRAINT opportunities_stage_check
        CHECK (stage IN (
            'invoice_received',
            'data_review',
            'proposal_preparation',
            'proposal_sent',
            'accepted',
            'activation',
            'won',
            'lost'
        )),
    CONSTRAINT opportunities_open_next_action_check
        CHECK (
            (
                stage IN ('won', 'lost')
                AND next_action_type IS NULL
                AND next_action_title IS NULL
                AND next_action_due_at IS NULL
            )
            OR (
                closed_at IS NULL
                AND next_action_type IS NOT NULL
                AND btrim(next_action_type) <> ''
                AND next_action_title IS NOT NULL
                AND btrim(next_action_title) <> ''
            )
        ),
    CONSTRAINT opportunities_won_state_check
        CHECK (
            stage <> 'won'
            OR (
                won_at IS NOT NULL
                AND lost_at IS NULL
                AND closed_at IS NOT NULL
            )
        ),
    CONSTRAINT opportunities_lost_state_check
        CHECK (
            stage <> 'lost'
            OR (
                lost_at IS NOT NULL
                AND won_at IS NULL
                AND closed_at IS NOT NULL
                AND loss_reason IS NOT NULL
                AND btrim(loss_reason) <> ''
            )
        ),
    CONSTRAINT opportunities_open_state_check
        CHECK (stage IN ('won', 'lost') OR closed_at IS NULL),
    CONSTRAINT opportunities_terminal_timestamp_check
        CHECK (
            (won_at IS NULL OR stage = 'won')
            AND (lost_at IS NULL OR stage = 'lost')
        ),
    CONSTRAINT opportunities_renewal_source_check
        CHECK (
            (type = 'renewal' AND source_contract_id IS NOT NULL)
            OR (type <> 'renewal' AND source_contract_id IS NULL)
        )
);

ALTER TABLE public.supply_points
    ADD CONSTRAINT supply_points_id_client_key UNIQUE (id, client_id);

ALTER TABLE public.opportunities
    ADD CONSTRAINT opportunities_supply_point_client_fkey
    FOREIGN KEY (supply_point_id, client_id)
    REFERENCES public.supply_points(id, client_id)
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX opportunities_one_open_cycle_per_supply
    ON public.opportunities (supply_point_id, type)
    WHERE closed_at IS NULL;

CREATE UNIQUE INDEX opportunities_one_renewal_per_contract
    ON public.opportunities (source_contract_id)
    WHERE type = 'renewal';

CREATE INDEX opportunities_owner_work_queue_idx
    ON public.opportunities (owner_id, closed_at, next_action_due_at);

CREATE INDEX opportunities_franchise_work_queue_idx
    ON public.opportunities (franchise_id, closed_at, next_action_due_at);

CREATE INDEX opportunities_stage_age_idx
    ON public.opportunities (stage, stage_entered_at)
    WHERE closed_at IS NULL;

CREATE INDEX opportunities_client_created_idx
    ON public.opportunities (client_id, created_at DESC);

CREATE TABLE public.opportunity_stage_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id uuid NOT NULL
        REFERENCES public.opportunities(id) ON DELETE CASCADE,
    from_stage text,
    to_stage text NOT NULL,
    actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason_code text,
    safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT opportunity_history_from_stage_check
        CHECK (
            from_stage IS NULL
            OR from_stage IN (
                'invoice_received',
                'data_review',
                'proposal_preparation',
                'proposal_sent',
                'accepted',
                'activation',
                'won',
                'lost'
            )
        ),
    CONSTRAINT opportunity_history_to_stage_check
        CHECK (
            to_stage IN (
                'invoice_received',
                'data_review',
                'proposal_preparation',
                'proposal_sent',
                'accepted',
                'activation',
                'won',
                'lost'
            )
        ),
    CONSTRAINT opportunity_history_metadata_object_check
        CHECK (jsonb_typeof(safe_metadata) = 'object')
);

CREATE INDEX opportunity_history_timeline_idx
    ON public.opportunity_stage_history (opportunity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_opportunity_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_opportunity_updated_at() FROM PUBLIC;

CREATE TRIGGER opportunities_updated_at
    BEFORE UPDATE ON public.opportunities
    FOR EACH ROW
    EXECUTE FUNCTION public.set_opportunity_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_opportunity_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'opportunity stage history is append-only'
        USING ERRCODE = '55000';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_opportunity_history_mutation() FROM PUBLIC;

CREATE TRIGGER opportunity_history_append_only
    BEFORE UPDATE OR DELETE ON public.opportunity_stage_history
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_opportunity_history_mutation();

ALTER TABLE public.ocr_jobs
    ADD COLUMN opportunity_id uuid,
    ADD COLUMN supply_point_id uuid,
    ADD COLUMN confirmed_at timestamptz,
    ADD COLUMN confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.proposals
    ADD COLUMN opportunity_id uuid,
    ADD COLUMN supply_point_id uuid;

ALTER TABLE public.contracts
    ADD COLUMN opportunity_id uuid,
    ADD COLUMN supply_point_id uuid,
    ADD COLUMN permanence_status text;

ALTER TABLE public.network_commissions
    ADD COLUMN opportunity_id uuid;

ALTER TABLE public.tasks
    ADD COLUMN opportunity_id uuid;

UPDATE public.contracts
SET permanence_status = CASE
    WHEN end_date IS NOT NULL THEN 'known'
    ELSE 'unknown'
END
WHERE permanence_status IS NULL;

ALTER TABLE public.contracts
    ALTER COLUMN permanence_status SET DEFAULT 'unknown',
    ALTER COLUMN permanence_status SET NOT NULL,
    ADD CONSTRAINT contracts_permanence_status_check
        CHECK (permanence_status IN ('known', 'none', 'unknown')),
    ADD CONSTRAINT contracts_permanence_value_check
        CHECK (
            (permanence_status <> 'known' OR end_date IS NOT NULL)
            AND (permanence_status <> 'none' OR end_date IS NULL)
        );

ALTER TABLE public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_opportunity_client_fkey
        FOREIGN KEY (opportunity_id, client_id)
        REFERENCES public.opportunities(id, client_id) ON DELETE RESTRICT,
    ADD CONSTRAINT ocr_jobs_supply_point_client_fkey
        FOREIGN KEY (supply_point_id, client_id)
        REFERENCES public.supply_points(id, client_id) ON DELETE RESTRICT,
    ADD CONSTRAINT ocr_jobs_opportunity_requires_client_check
        CHECK (opportunity_id IS NULL OR client_id IS NOT NULL),
    ADD CONSTRAINT ocr_jobs_supply_point_requires_client_check
        CHECK (supply_point_id IS NULL OR client_id IS NOT NULL);

ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_opportunity_client_fkey
        FOREIGN KEY (opportunity_id, client_id)
        REFERENCES public.opportunities(id, client_id) ON DELETE RESTRICT,
    ADD CONSTRAINT proposals_supply_point_client_fkey
        FOREIGN KEY (supply_point_id, client_id)
        REFERENCES public.supply_points(id, client_id) ON DELETE RESTRICT;

ALTER TABLE public.contracts
    ADD CONSTRAINT contracts_opportunity_client_fkey
        FOREIGN KEY (opportunity_id, client_id)
        REFERENCES public.opportunities(id, client_id) ON DELETE RESTRICT,
    ADD CONSTRAINT contracts_supply_point_client_fkey
        FOREIGN KEY (supply_point_id, client_id)
        REFERENCES public.supply_points(id, client_id) ON DELETE RESTRICT;

ALTER TABLE public.network_commissions
    ADD CONSTRAINT network_commissions_opportunity_fkey
        FOREIGN KEY (opportunity_id)
        REFERENCES public.opportunities(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_opportunity_client_fkey
        FOREIGN KEY (opportunity_id, client_id)
        REFERENCES public.opportunities(id, client_id) ON DELETE RESTRICT,
    ADD CONSTRAINT tasks_opportunity_requires_client_check
        CHECK (opportunity_id IS NULL OR client_id IS NOT NULL);

CREATE INDEX ocr_jobs_opportunity_idx
    ON public.ocr_jobs (opportunity_id, created_at DESC)
    WHERE opportunity_id IS NOT NULL;

CREATE INDEX ocr_jobs_supply_point_idx
    ON public.ocr_jobs (supply_point_id, created_at DESC)
    WHERE supply_point_id IS NOT NULL;

CREATE INDEX proposals_opportunity_idx
    ON public.proposals (opportunity_id, created_at DESC)
    WHERE opportunity_id IS NOT NULL;

CREATE INDEX contracts_opportunity_idx
    ON public.contracts (opportunity_id, created_at DESC)
    WHERE opportunity_id IS NOT NULL;

CREATE UNIQUE INDEX contracts_one_per_proposal_idx
    ON public.contracts (proposal_id)
    WHERE proposal_id IS NOT NULL;

CREATE INDEX contracts_renewal_lookup_idx
    ON public.contracts (end_date, agent_id)
    WHERE status = 'active' AND end_date IS NOT NULL;

CREATE INDEX network_commissions_opportunity_idx
    ON public.network_commissions (opportunity_id)
    WHERE opportunity_id IS NOT NULL;

CREATE INDEX tasks_opportunity_open_idx
    ON public.tasks (opportunity_id, due_date)
    WHERE opportunity_id IS NOT NULL
      AND status IN ('pending', 'in_progress');

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY opportunities_select_portfolio
    ON public.opportunities
    FOR SELECT
    TO authenticated
    USING (
        owner_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.profiles viewer
            WHERE viewer.id = (SELECT auth.uid())
              AND (
                  viewer.role = 'admin'
                  OR (
                      viewer.role = 'franchise'
                      AND viewer.franchise_id = opportunities.franchise_id
                  )
              )
        )
    );

CREATE POLICY opportunity_history_select_portfolio
    ON public.opportunity_stage_history
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.opportunities opportunity
            WHERE opportunity.id = opportunity_stage_history.opportunity_id
        )
    );

REVOKE ALL ON public.opportunities FROM anon, authenticated;
REVOKE ALL ON public.opportunity_stage_history FROM anon, authenticated;
GRANT SELECT ON public.opportunities TO authenticated;
GRANT SELECT ON public.opportunity_stage_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.opportunities TO service_role;
GRANT SELECT, INSERT ON public.opportunity_stage_history TO service_role;

COMMENT ON TABLE public.opportunities IS
    'Canonical commercial process for one client and one supply point.';
COMMENT ON TABLE public.opportunity_stage_history IS
    'Append-only history of canonical opportunity stage transitions. Metadata must not contain PII.';
COMMENT ON COLUMN public.opportunities.source_contract_id IS
    'Required for renewal opportunities; links the new cycle to the expiring contract.';
COMMENT ON COLUMN public.contracts.permanence_status IS
    'Explicit permanence knowledge: known, none or unknown.';

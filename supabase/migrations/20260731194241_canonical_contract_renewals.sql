-- Canonical contract-expiry workflow: one renewal per contract and durable reminders.

ALTER TABLE public.notifications
    ADD COLUMN source_key text;

CREATE UNIQUE INDEX notifications_source_key_unique
    ON public.notifications (source_key)
    WHERE source_key IS NOT NULL;

CREATE TABLE public.contract_renewal_reminders (
    contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    threshold_days integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (contract_id, threshold_days),
    CONSTRAINT contract_renewal_reminder_threshold_check
        CHECK (threshold_days IN (0, 7, 30, 60))
);

ALTER TABLE public.contract_renewal_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_renewal_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.contract_renewal_reminders TO service_role;

CREATE VIEW public.contract_renewal_data_quality
WITH (security_invoker = true, security_barrier = true) AS
SELECT
    contract.id AS contract_id,
    contract.client_id,
    contract.supply_point_id,
    contract.agent_id AS owner_id,
    owner.full_name AS owner_name,
    contract.franchise_id,
    client.name AS client_name,
    concat(
        CASE supply.supply_type
            WHEN 'electricity' THEN 'Electricidad'
            WHEN 'gas' THEN 'Gas'
            ELSE 'Suministro'
        END,
        CASE WHEN supply.cups_last4 IS NULL THEN '' ELSE ' · ' || supply.cups_last4 END
    ) AS supply_label,
    contract.marketer_name,
    contract.tariff_name,
    contract.start_date,
    contract.permanence_status,
    'confirm_permanence'::text AS required_action
FROM public.contracts contract
JOIN public.clients client ON client.id = contract.client_id
JOIN public.profiles owner ON owner.id = contract.agent_id
LEFT JOIN public.supply_points supply ON supply.id = contract.supply_point_id
WHERE contract.status = 'active'
  AND contract.permanence_status = 'unknown';

REVOKE ALL ON public.contract_renewal_data_quality FROM PUBLIC, anon;
GRANT SELECT ON public.contract_renewal_data_quality TO authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_contract_renewals(
    p_as_of date DEFAULT current_date
)
RETURNS TABLE (
    contract_id uuid,
    opportunity_id uuid,
    owner_id uuid,
    threshold_days integer,
    opportunity_created boolean,
    reminder_created boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    candidate record;
    renewal_id uuid;
    renewal_stage text;
    renewal_action_type text;
    renewal_action_title text;
    renewal_due_at timestamptz;
    days_remaining integer;
    selected_threshold integer;
    did_create_opportunity boolean;
    did_create_reminder boolean;
    transition_at timestamptz := clock_timestamp();
BEGIN
    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'renewal date is required' USING ERRCODE = '22023';
    END IF;

    FOR candidate IN
        SELECT
            contract.id,
            contract.client_id,
            contract.supply_point_id,
            contract.agent_id,
            contract.franchise_id,
            contract.end_date
        FROM public.contracts contract
        WHERE contract.status = 'active'
          AND contract.permanence_status = 'known'
          AND contract.end_date IS NOT NULL
          AND contract.end_date <= p_as_of + 60
          AND contract.supply_point_id IS NOT NULL
        ORDER BY contract.end_date, contract.id
        FOR UPDATE SKIP LOCKED
    LOOP
        did_create_opportunity := false;
        did_create_reminder := false;
        renewal_id := NULL;

        IF EXISTS (
            SELECT 1
            FROM public.ocr_jobs job
            WHERE job.client_id = candidate.client_id
              AND job.supply_point_id = candidate.supply_point_id
              AND job.status = 'completed'
              AND job.confirmed_at >= p_as_of::timestamptz - interval '90 days'
        ) THEN
            renewal_stage := 'proposal_preparation';
            renewal_action_type := 'prepare_renewal';
            renewal_action_title := 'Preparar renovación';
        ELSE
            renewal_stage := 'data_review';
            renewal_action_type := 'request_updated_invoice';
            renewal_action_title := 'Solicitar factura actualizada';
        END IF;

        renewal_due_at := (
            greatest(
                p_as_of,
                least(p_as_of + 7, candidate.end_date - 30)
            )::timestamp + time '09:00'
        ) AT TIME ZONE 'Europe/Madrid';

        INSERT INTO public.opportunities (
            client_id, supply_point_id, owner_id, franchise_id,
            type, stage, source, stage_entered_at,
            next_action_type, next_action_title, next_action_due_at,
            expected_close_date, source_contract_id
        ) VALUES (
            candidate.client_id, candidate.supply_point_id, candidate.agent_id, candidate.franchise_id,
            'renewal', renewal_stage, 'contract_expiry', transition_at,
            renewal_action_type, renewal_action_title, renewal_due_at,
            candidate.end_date, candidate.id
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO renewal_id;

        IF renewal_id IS NOT NULL THEN
            did_create_opportunity := true;
            INSERT INTO public.opportunity_stage_history (
                opportunity_id, from_stage, to_stage, actor_id,
                reason_code, safe_metadata, created_at
            ) VALUES (
                renewal_id, NULL, renewal_stage, NULL,
                'renewal_window_opened',
                jsonb_build_object('source_contract_id', candidate.id, 'threshold_days', 60),
                transition_at
            );
        ELSE
            SELECT opportunity.id INTO renewal_id
            FROM public.opportunities opportunity
            WHERE opportunity.source_contract_id = candidate.id
              AND opportunity.type = 'renewal';
        END IF;

        IF renewal_id IS NULL THEN
            CONTINUE;
        END IF;

        days_remaining := candidate.end_date - p_as_of;
        selected_threshold := CASE
            WHEN days_remaining <= 0 THEN 0
            WHEN days_remaining <= 7 THEN 7
            WHEN days_remaining <= 30 THEN 30
            ELSE 60
        END;

        INSERT INTO public.contract_renewal_reminders (
            contract_id, opportunity_id, threshold_days
        ) VALUES (
            candidate.id, renewal_id, selected_threshold
        )
        ON CONFLICT DO NOTHING
        RETURNING true INTO did_create_reminder;

        did_create_reminder := coalesce(did_create_reminder, false);

        IF did_create_reminder THEN
            INSERT INTO public.notifications (
                user_id, title, message, type, link, expires_at, source_key
            ) VALUES (
                candidate.agent_id,
                CASE WHEN selected_threshold = 0 THEN 'Contrato vencido' ELSE 'Vencimiento próximo' END,
                CASE
                    WHEN selected_threshold = 0 THEN 'El contrato ha alcanzado su fecha de vencimiento.'
                    ELSE format('El contrato vence en %s días.', selected_threshold)
                END,
                'warning',
                '/dashboard/opportunities/' || renewal_id::text,
                now() + interval '90 days',
                format('renewal:%s:%s:%s', candidate.id, selected_threshold, candidate.agent_id)
            )
            ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO NOTHING;

            INSERT INTO public.notifications (
                user_id, title, message, type, link, expires_at, source_key
            )
            SELECT
                admin.id,
                CASE WHEN selected_threshold = 0 THEN 'Contrato vencido' ELSE 'Vencimiento próximo' END,
                CASE
                    WHEN selected_threshold = 0 THEN 'Un contrato ha alcanzado su fecha de vencimiento.'
                    ELSE format('Un contrato vence en %s días.', selected_threshold)
                END,
                'warning',
                '/dashboard/opportunities/' || renewal_id::text,
                now() + interval '90 days',
                format('renewal:%s:%s:%s', candidate.id, selected_threshold, admin.id)
            FROM public.profiles admin
            WHERE admin.role = 'admin'
              AND admin.id <> candidate.agent_id
            ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO NOTHING;
        END IF;

        RETURN QUERY SELECT
            candidate.id,
            renewal_id,
            candidate.agent_id,
            selected_threshold,
            did_create_opportunity,
            did_create_reminder;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_contract_renewals(date)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_contract_renewals(date)
TO service_role;

COMMENT ON FUNCTION public.reconcile_contract_renewals(date)
IS 'Creates one canonical renewal per eligible active contract and durable reminders at 60, 30, 7 and 0 days. Service workflow only.';

CREATE OR REPLACE FUNCTION public.confirm_contract_permanence(
    p_contract_id uuid,
    p_actor_id uuid,
    p_permanence_status text,
    p_end_date date DEFAULT NULL
)
RETURNS public.contracts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    target public.contracts%ROWTYPE;
    actor_role text;
    actor_franchise_id uuid;
    updated_contract public.contracts%ROWTYPE;
BEGIN
    SELECT profile.role, profile.franchise_id
    INTO actor_role, actor_franchise_id
    FROM public.profiles profile
    WHERE profile.id = p_actor_id;

    IF actor_role IS NULL THEN
        RAISE EXCEPTION 'contract actor unavailable' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO target
    FROM public.contracts contract
    WHERE contract.id = p_contract_id
    FOR UPDATE;

    IF NOT FOUND OR target.status <> 'active' THEN
        RAISE EXCEPTION 'active contract unavailable' USING ERRCODE = 'P0002';
    END IF;

    IF NOT (
        actor_role = 'admin'
        OR target.agent_id = p_actor_id
        OR (
            actor_role = 'franchise'
            AND actor_franchise_id IS NOT DISTINCT FROM target.franchise_id
        )
    ) THEN
        RAISE EXCEPTION 'contract outside actor portfolio' USING ERRCODE = '42501';
    END IF;

    IF p_permanence_status NOT IN ('known', 'none')
       OR (p_permanence_status = 'known' AND (p_end_date IS NULL OR p_end_date < target.start_date))
       OR (p_permanence_status = 'none' AND p_end_date IS NOT NULL)
    THEN
        RAISE EXCEPTION 'invalid permanence details' USING ERRCODE = '22023';
    END IF;

    UPDATE public.contracts
    SET
        permanence_status = p_permanence_status,
        end_date = CASE WHEN p_permanence_status = 'known' THEN p_end_date ELSE NULL END,
        updated_at = clock_timestamp()
    WHERE id = target.id
    RETURNING * INTO updated_contract;

    INSERT INTO public.client_activities (
        client_id, agent_id, franchise_id, type, description, metadata
    ) VALUES (
        target.client_id, target.agent_id, target.franchise_id,
        'contract_permanence_confirmed', 'Permanencia del contrato confirmada.',
        jsonb_build_object(
            'contract_id', target.id,
            'permanence_status', p_permanence_status,
            'end_date', p_end_date
        )
    );

    RETURN updated_contract;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_contract_permanence(uuid,uuid,text,date)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_contract_permanence(uuid,uuid,text,date)
TO service_role;

COMMENT ON FUNCTION public.confirm_contract_permanence(uuid,uuid,text,date)
IS 'Confirms a known contract end date or explicit absence of permanence after portfolio authorization. Service workflow only.';

-- Transactional RLS verification for ZIN-SDD-040 T6.
-- Creates synthetic non-PII rows and rolls every change back.
-- Expected result: command success and no persisted rows.

BEGIN;

DO $$
DECLARE
    agent_profile public.profiles%ROWTYPE;
    admin_profile public.profiles%ROWTYPE;
    own_client_id uuid := gen_random_uuid();
    franchise_client_id uuid := gen_random_uuid();
    outside_client_id uuid := gen_random_uuid();
    own_supply_id uuid := gen_random_uuid();
    franchise_supply_id uuid := gen_random_uuid();
    outside_supply_id uuid := gen_random_uuid();
BEGIN
    SELECT *
    INTO agent_profile
    FROM public.profiles
    WHERE role = 'agent'
      AND franchise_id IS NOT NULL
    ORDER BY created_at
    LIMIT 1;

    SELECT *
    INTO admin_profile
    FROM public.profiles
    WHERE role = 'admin'
    ORDER BY created_at
    LIMIT 1;

    IF agent_profile.id IS NULL OR admin_profile.id IS NULL THEN
        RAISE EXCEPTION 'RLS fixture requires one agent with franchise and one admin';
    END IF;

    INSERT INTO public.clients (id, owner_id, franchise_id, name)
    VALUES
        (own_client_id, agent_profile.id, agent_profile.franchise_id, 'CRM queue RLS test own'),
        (franchise_client_id, admin_profile.id, agent_profile.franchise_id, 'CRM queue RLS test franchise'),
        (outside_client_id, admin_profile.id, NULL, 'CRM queue RLS test outside');

    INSERT INTO public.supply_points (id, client_id)
    VALUES
        (own_supply_id, own_client_id),
        (franchise_supply_id, franchise_client_id),
        (outside_supply_id, outside_client_id);

    INSERT INTO public.opportunities (
        client_id,
        supply_point_id,
        owner_id,
        franchise_id,
        type,
        stage,
        next_action_type,
        next_action_title
    )
    VALUES
        (
            own_client_id,
            own_supply_id,
            agent_profile.id,
            agent_profile.franchise_id,
            'new_business',
            'invoice_received',
            'wait_for_ocr',
            'Ver estado del OCR'
        ),
        (
            franchise_client_id,
            franchise_supply_id,
            admin_profile.id,
            agent_profile.franchise_id,
            'switch',
            'data_review',
            'review_invoice',
            'Revisar factura'
        ),
        (
            outside_client_id,
            outside_supply_id,
            admin_profile.id,
            NULL,
            'switch',
            'proposal_preparation',
            'compare_tariffs',
            'Comparar tarifas'
        );

    PERFORM set_config('crm_test.agent_id', agent_profile.id::text, true);
    PERFORM set_config('crm_test.admin_id', admin_profile.id::text, true);
END;
$$;

SELECT set_config(
    'request.jwt.claim.sub',
    current_setting('crm_test.agent_id'),
    true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM public.crm_work_queue
        WHERE client_name LIKE 'CRM queue RLS test%'
    ) <> 1 THEN
        RAISE EXCEPTION 'agent queue scope is invalid';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.crm_work_queue
        WHERE owner_id <> auth.uid()
    ) THEN
        RAISE EXCEPTION 'agent can see another owner queue';
    END IF;
END;
$$;

RESET ROLE;

UPDATE public.profiles
SET role = 'franchise'
WHERE id = current_setting('crm_test.agent_id')::uuid;

SELECT set_config(
    'request.jwt.claim.sub',
    current_setting('crm_test.agent_id'),
    true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM public.crm_work_queue
        WHERE client_name LIKE 'CRM queue RLS test%'
    ) <> 2 THEN
        RAISE EXCEPTION 'franchise queue scope is invalid';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.crm_work_queue
        WHERE franchise_id IS DISTINCT FROM (
            SELECT franchise_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    ) THEN
        RAISE EXCEPTION 'franchise can see an outside queue';
    END IF;
END;
$$;

RESET ROLE;

SELECT set_config(
    'request.jwt.claim.sub',
    current_setting('crm_test.admin_id'),
    true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM public.crm_work_queue
        WHERE client_name LIKE 'CRM queue RLS test%'
    ) <> 3 THEN
        RAISE EXCEPTION 'admin queue scope is invalid';
    END IF;
END;
$$;

RESET ROLE;
ROLLBACK;

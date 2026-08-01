-- Target: staging.
-- Purpose: verify the canonical OCR -> opportunity workflow without retaining data.
-- Operator/date: Codex, 2026-07-31.
-- Rollback: the entire verification runs inside a transaction and ends with ROLLBACK.

BEGIN;

DO $permissions$
BEGIN
    IF has_function_privilege(
        'anon',
        'public.reconcile_crm_ocr_opportunity(uuid,text,text,text,text,text,text,text,text,text,jsonb,numeric)',
        'EXECUTE'
    )
       OR has_function_privilege(
        'authenticated',
        'public.reconcile_crm_ocr_opportunity(uuid,text,text,text,text,text,text,text,text,text,jsonb,numeric)',
        'EXECUTE'
    )
       OR NOT has_function_privilege(
        'service_role',
        'public.reconcile_crm_ocr_opportunity(uuid,text,text,text,text,text,text,text,text,text,jsonb,numeric)',
        'EXECUTE'
    )
    THEN
        RAISE EXCEPTION 'unexpected reconcile_crm_ocr_opportunity privileges';
    END IF;

    IF has_function_privilege(
        'anon',
        'public.confirm_crm_ocr_data(uuid,uuid,jsonb)',
        'EXECUTE'
    )
       OR has_function_privilege(
        'authenticated',
        'public.confirm_crm_ocr_data(uuid,uuid,jsonb)',
        'EXECUTE'
    )
       OR NOT has_function_privilege(
        'service_role',
        'public.confirm_crm_ocr_data(uuid,uuid,jsonb)',
        'EXECUTE'
    )
    THEN
        RAISE EXCEPTION 'unexpected confirm_crm_ocr_data privileges';
    END IF;
END;
$permissions$;

DO $verify$
DECLARE
    actor_id uuid;
    second_uploader_id uuid;
    actor_franchise_id uuid;
    first_job_id uuid := gen_random_uuid();
    second_job_id uuid := gen_random_uuid();
    failed_job_id uuid := gen_random_uuid();
    protected_cups_hash text := repeat('a', 64);
    protected_dni_hash text := repeat('b', 64);
    first_resolution record;
    repeated_resolution record;
    second_resolution record;
    confirmed_opportunity public.opportunities%ROWTYPE;
    linked_job public.ocr_jobs%ROWTYPE;
    stored_opportunity public.opportunities%ROWTYPE;
    entity_count integer;
BEGIN
    SELECT profile.id, profile.franchise_id
    INTO actor_id, actor_franchise_id
    FROM public.profiles profile
    WHERE profile.role = 'agent'
    ORDER BY profile.created_at
    LIMIT 1;

    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'verification requires one existing agent profile';
    END IF;

    SELECT profile.id
    INTO second_uploader_id
    FROM public.profiles profile
    WHERE profile.id <> actor_id
      AND (
          profile.role = 'admin'
          OR profile.franchise_id IS NOT DISTINCT FROM actor_franchise_id
      )
    ORDER BY CASE WHEN profile.role = 'admin' THEN 1 ELSE 0 END, profile.created_at
    LIMIT 1;

    second_uploader_id := COALESCE(second_uploader_id, actor_id);

    INSERT INTO public.ocr_jobs (
        id,
        franchise_id,
        agent_id,
        file_name,
        status,
        extracted_data,
        client_segment
    )
    VALUES (
        first_job_id,
        actor_franchise_id,
        actor_id,
        'sdd-ocr-opportunity-first.pdf',
        'completed',
        '{"source":"sdd_verification"}'::jsonb,
        'RESIDENCIAL'
    );

    SELECT *
    INTO first_resolution
    FROM public.reconcile_crm_ocr_opportunity(
        first_job_id,
        'Cliente SDD temporal',
        'v1.synthetic-cups',
        protected_cups_hash,
        'AA1F',
        'v1.synthetic-dni',
        protected_dni_hash,
        'Dirección de verificación',
        'Comercializadora origen',
        '2.0TD',
        '{"p1":4.6,"p2":4.6}'::jsonb,
        100
    );

    IF first_resolution.resolution <> 'linked'
       OR first_resolution.opportunity_stage <> 'data_review'
       OR NOT first_resolution.opportunity_created
       OR NOT first_resolution.opportunity_advanced
    THEN
        RAISE EXCEPTION 'first reconciliation did not create a data-review opportunity';
    END IF;

    SELECT *
    INTO repeated_resolution
    FROM public.reconcile_crm_ocr_opportunity(
        first_job_id,
        'Cliente SDD temporal',
        'v1.synthetic-cups',
        protected_cups_hash,
        'AA1F',
        'v1.synthetic-dni',
        protected_dni_hash,
        'Dirección de verificación',
        'Comercializadora origen',
        '2.0TD',
        '{"p1":4.6,"p2":4.6}'::jsonb,
        100
    );

    IF repeated_resolution.opportunity_id IS DISTINCT FROM first_resolution.opportunity_id
       OR repeated_resolution.opportunity_created
       OR repeated_resolution.opportunity_advanced
    THEN
        RAISE EXCEPTION 'repeating the same job is not idempotent';
    END IF;

    INSERT INTO public.ocr_jobs (
        id,
        franchise_id,
        agent_id,
        file_name,
        status,
        extracted_data,
        client_segment
    )
    VALUES (
        second_job_id,
        actor_franchise_id,
        second_uploader_id,
        'sdd-ocr-opportunity-second.pdf',
        'completed',
        '{"source":"sdd_verification"}'::jsonb,
        'RESIDENCIAL'
    );

    SELECT *
    INTO second_resolution
    FROM public.reconcile_crm_ocr_opportunity(
        second_job_id,
        'Cliente SDD temporal',
        'v1.synthetic-cups',
        protected_cups_hash,
        'AA1F',
        'v1.synthetic-dni',
        protected_dni_hash,
        'Dirección actualizada',
        'Comercializadora origen',
        '2.0TD',
        '{"p1":5.75,"p2":5.75}'::jsonb,
        110
    );

    IF second_resolution.opportunity_id IS DISTINCT FROM first_resolution.opportunity_id
       OR second_resolution.opportunity_created
       OR second_resolution.opportunity_advanced
    THEN
        RAISE EXCEPTION 'a repeated supply did not reuse its open switch opportunity';
    END IF;

    SELECT *
    INTO stored_opportunity
    FROM public.opportunities
    WHERE id = first_resolution.opportunity_id;

    IF stored_opportunity.owner_id IS DISTINCT FROM actor_id THEN
        RAISE EXCEPTION 'a later uploader changed the accountable owner';
    END IF;

    INSERT INTO public.ocr_jobs (
        id,
        franchise_id,
        agent_id,
        file_name,
        status,
        error_message,
        client_segment
    )
    VALUES (
        failed_job_id,
        actor_franchise_id,
        actor_id,
        'sdd-ocr-opportunity-failed.pdf',
        'failed',
        'synthetic failure',
        'RESIDENCIAL'
    );

    BEGIN
        PERFORM *
        FROM public.reconcile_crm_ocr_opportunity(
            failed_job_id,
            'Cliente SDD temporal',
            'v1.synthetic-other-cups',
            repeat('c', 64),
            'BB2G',
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL
        );
        RAISE EXCEPTION 'a failed OCR job was reconciled';
    EXCEPTION
        WHEN SQLSTATE '22023' THEN
            NULL;
    END;

    SELECT *
    INTO confirmed_opportunity
    FROM public.confirm_crm_ocr_data(
        first_job_id,
        actor_id,
        '{"client_name":"Cliente SDD temporal","cups":"masked","period_days":30}'::jsonb
    );

    IF confirmed_opportunity.stage <> 'proposal_preparation' THEN
        RAISE EXCEPTION 'OCR confirmation did not advance the opportunity';
    END IF;

    SELECT *
    INTO confirmed_opportunity
    FROM public.confirm_crm_ocr_data(
        first_job_id,
        actor_id,
        '{"client_name":"Cliente SDD temporal","cups":"masked","period_days":30}'::jsonb
    );

    SELECT *
    INTO linked_job
    FROM public.ocr_jobs
    WHERE id = first_job_id;

    IF linked_job.confirmed_at IS NULL
       OR linked_job.confirmed_by IS DISTINCT FROM actor_id
       OR confirmed_opportunity.stage <> 'proposal_preparation'
    THEN
        RAISE EXCEPTION 'OCR confirmation is not persisted or idempotent';
    END IF;

    SELECT count(*)
    INTO entity_count
    FROM public.clients
    WHERE cups_hash = protected_cups_hash;
    IF entity_count <> 1 THEN
        RAISE EXCEPTION 'expected exactly one client, found %', entity_count;
    END IF;

    SELECT count(*)
    INTO entity_count
    FROM public.supply_points
    WHERE cups_hash = protected_cups_hash;
    IF entity_count <> 1 THEN
        RAISE EXCEPTION 'expected exactly one supply point, found %', entity_count;
    END IF;

    SELECT count(*)
    INTO entity_count
    FROM public.opportunities
    WHERE id = first_resolution.opportunity_id;
    IF entity_count <> 1 THEN
        RAISE EXCEPTION 'expected exactly one opportunity, found %', entity_count;
    END IF;

    RAISE NOTICE 'CRM OCR opportunity workflow verification passed';
END;
$verify$;

ROLLBACK;

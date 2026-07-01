-- Fix proposal acceptance trigger.
-- The previous function referenced NEW.closed_company, but that column belongs
-- to ocr_jobs, not proposals. Accepting a public proposal therefore failed
-- before side effects could run.

CREATE OR REPLACE FUNCTION public.auto_log_switch_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_client_id uuid;
    v_previous_supplier text;
    v_new_marketer text;
BEGIN
    IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
        v_client_id := NEW.client_id;
        IF v_client_id IS NULL THEN
            RETURN NEW;
        END IF;

        v_new_marketer := COALESCE(
            NULLIF(NEW.offer_snapshot ->> 'marketer_name', ''),
            NULLIF(NEW.offer_snapshot ->> 'company', ''),
            NULLIF(NEW.offer_snapshot ->> 'provider', ''),
            'Nueva comercializadora'
        );

        SELECT current_supplier INTO v_previous_supplier
        FROM public.clients
        WHERE id = v_client_id;

        INSERT INTO public.switch_events (
            client_id,
            switch_date,
            previous_marketer,
            new_marketer,
            annual_savings,
            proposal_id
        )
        VALUES (
            v_client_id,
            CURRENT_DATE,
            v_previous_supplier,
            v_new_marketer,
            COALESCE(NEW.annual_savings, 0),
            NEW.id
        )
        ON CONFLICT DO NOTHING;

        UPDATE public.clients
        SET current_supplier = v_new_marketer
        WHERE id = v_client_id;
    END IF;

    RETURN NEW;
END;
$$;

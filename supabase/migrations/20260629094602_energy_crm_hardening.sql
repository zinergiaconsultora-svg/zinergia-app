-- Energy CRM hardening:
-- - make write policies explicit with WITH CHECK
-- - avoid SECURITY DEFINER for the public trigger function
-- - keep CUPS encrypted/de-identified in the new energy tables

UPDATE public.supply_points SET cups = NULL WHERE cups IS NOT NULL;
ALTER TABLE public.supply_points DROP CONSTRAINT IF EXISTS supply_points_no_plaintext_cups;
ALTER TABLE public.supply_points
    ADD CONSTRAINT supply_points_no_plaintext_cups CHECK (cups IS NULL);

UPDATE public.switch_events SET cups = NULL WHERE cups IS NOT NULL;
ALTER TABLE public.switch_events DROP CONSTRAINT IF EXISTS switch_events_no_plaintext_cups;
ALTER TABLE public.switch_events
    ADD CONSTRAINT switch_events_no_plaintext_cups CHECK (cups IS NULL);

DROP POLICY IF EXISTS "Users can manage supply points in their franchise" ON public.supply_points;
CREATE POLICY "Users can manage supply points in their franchise"
    ON public.supply_points FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.clients c
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE c.id = supply_points.client_id
              AND (p.role = 'admin' OR c.franchise_id = p.franchise_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.clients c
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE c.id = supply_points.client_id
              AND (p.role = 'admin' OR c.franchise_id = p.franchise_id)
        )
    );

DROP POLICY IF EXISTS "Users can manage switch events in their franchise" ON public.switch_events;
CREATE POLICY "Users can manage switch events in their franchise"
    ON public.switch_events FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.clients c
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE c.id = switch_events.client_id
              AND (p.role = 'admin' OR c.franchise_id = p.franchise_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.clients c
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE c.id = switch_events.client_id
              AND (p.role = 'admin' OR c.franchise_id = p.franchise_id)
        )
    );

CREATE OR REPLACE FUNCTION public.auto_log_switch_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_client_id uuid;
    v_previous_supplier text;
BEGIN
    IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
        v_client_id := NEW.client_id;
        IF v_client_id IS NULL THEN
            RETURN NEW;
        END IF;

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
            COALESCE(NEW.closed_company, 'Nueva comercializadora'),
            COALESCE(NEW.annual_savings, 0),
            NEW.id
        )
        ON CONFLICT DO NOTHING;

        UPDATE public.clients
        SET current_supplier = COALESCE(NEW.closed_company, current_supplier)
        WHERE id = v_client_id;
    END IF;

    RETURN NEW;
END;
$$;

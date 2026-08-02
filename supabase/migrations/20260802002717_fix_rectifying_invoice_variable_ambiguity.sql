BEGIN;

CREATE OR REPLACE FUNCTION public.create_rectifying_invoice_draft(p_request_id uuid, p_actor_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_request public.fiscal_rectification_requests%ROWTYPE;
    v_source public.invoices%ROWTYPE;
    v_adjustment public.commission_adjustments%ROWTYPE;
    v_actor_role text;
    v_created_invoice_id uuid;
    v_number text;
    v_series text;
    v_base numeric(12,2);
    v_tax numeric(12,2);
    v_retention numeric(12,2);
    v_total numeric(12,2);
BEGIN
    SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id;
    SELECT * INTO v_request FROM public.fiscal_rectification_requests WHERE id = p_request_id FOR UPDATE;
    SELECT * INTO v_source FROM public.invoices WHERE id = v_request.source_invoice_id FOR UPDATE;
    SELECT * INTO v_adjustment FROM public.commission_adjustments WHERE id = v_request.adjustment_id;
    IF v_request.id IS NULL OR v_source.id IS NULL OR v_adjustment.id IS NULL
       OR v_request.status <> 'pending' OR v_source.status NOT IN ('issued', 'paid')
       OR (v_source.self_billing AND v_actor_role <> 'admin')
       OR (NOT v_source.self_billing AND p_actor_id <> v_source.agent_id)
    THEN RAISE EXCEPTION 'rectifying draft unavailable' USING ERRCODE = '42501'; END IF;

    v_base := -v_adjustment.commercial_amount;
    v_tax := round(v_base * v_source.tax_percent / 100.0, 2);
    v_retention := round(v_base * v_source.retention_percent / 100.0, 2);
    v_total := v_base + v_tax - v_retention;
    v_series := CASE WHEN v_source.self_billing THEN 'AUTO-RECT' ELSE 'RECT' END;
    v_number := private.next_fiscal_document_number(v_source.agent_id, v_series);

    INSERT INTO public.invoices (
        invoice_number, agent_id, franchise_id, issuer_name, issuer_nif, issuer_address,
        issuer_city, issuer_postal_code, recipient_name, recipient_nif, recipient_address,
        recipient_city, recipient_postal_code, due_date, subtotal, retention_total,
        retention_percent, tax_base, tax_type, tax_percent, tax_amount, total, status,
        document_kind, source_invoice_id, rectification_reason, self_billing,
        self_billing_agreement_id, acceptance_status, created_by
    ) VALUES (
        v_number, v_source.agent_id, v_source.franchise_id, v_source.issuer_name, v_source.issuer_nif,
        v_source.issuer_address, v_source.issuer_city, v_source.issuer_postal_code,
        v_source.recipient_name, v_source.recipient_nif, v_source.recipient_address,
        v_source.recipient_city, v_source.recipient_postal_code, current_date + 30,
        v_base, v_retention, v_source.retention_percent, v_base, v_source.tax_type, v_source.tax_percent,
        v_tax, v_total, 'draft', 'rectifying_invoice', v_source.id,
        v_adjustment.reason_code || ': ' || v_adjustment.evidence_reference,
        v_source.self_billing, v_source.self_billing_agreement_id,
        CASE WHEN v_source.self_billing THEN 'pending' ELSE 'not_required' END, p_actor_id
    ) RETURNING id INTO v_created_invoice_id;

    INSERT INTO public.fiscal_invoice_commission_lines (
        invoice_id, commission_id, adjustment_id, description, base_amount, tax_percent,
        tax_amount, retention_percent, retention_amount, total_amount
    ) VALUES (
        v_created_invoice_id, v_request.commission_id, v_request.adjustment_id,
        'Rectificación de ' || v_source.invoice_number || ' · ' || v_adjustment.reason_code,
        v_base, v_source.tax_percent, v_tax, v_source.retention_percent, v_retention, v_total
    );
    UPDATE public.invoices fiscal_invoice
    SET invoice_lines = jsonb_build_array(jsonb_build_object(
        'description', 'Rectificación de ' || v_source.invoice_number || ' · ' || v_adjustment.reason_code,
        'commission_id', v_request.commission_id,
        'base_amount', v_base,
        'tax_amount', v_tax,
        'retention', v_retention,
        'total_line', v_total
    ))
    WHERE fiscal_invoice.id = v_created_invoice_id;
    UPDATE public.fiscal_rectification_requests
    SET status = 'drafted', rectifying_invoice_id = v_created_invoice_id
    WHERE id = v_request.id;
    RETURN v_created_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_rectifying_invoice_draft(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_rectifying_invoice_draft(uuid,uuid) TO service_role;

COMMIT;

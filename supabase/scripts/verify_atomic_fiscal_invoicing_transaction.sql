-- Target: staging only before production promotion.
-- Uses existing non-PII identifiers, rolls back every mutation and returns "ok".
BEGIN;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
    v_admin_id uuid;
    v_commercial_id uuid;
    v_commission_id uuid;
    v_agreement_id uuid;
    v_first_invoice_id uuid;
    v_issued_invoice_id uuid;
    v_adjustment_id uuid;
    v_rectification_request_id uuid;
    v_rectifying_invoice_id uuid;
    duplicate_denied boolean := false;
    source_invoice public.invoices%ROWTYPE;
BEGIN
    SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' ORDER BY created_at, id LIMIT 1;
    SELECT id INTO v_commercial_id
    FROM public.profiles
    WHERE id <> v_admin_id
    ORDER BY created_at, id
    LIMIT 1;

    IF v_admin_id IS NULL OR v_commercial_id IS NULL THEN
        RAISE EXCEPTION 'verification requires one admin and one distinct commercial';
    END IF;

    SELECT commission.id INTO v_commission_id
    FROM public.network_commissions commission
    WHERE commission.agent_id = v_commercial_id
      AND commission.commercial_net_amount - commission.total_reversed_commercial > 0.01
    ORDER BY commission.created_at, commission.id
    LIMIT 1;

    IF v_commission_id IS NULL THEN
        INSERT INTO public.network_commissions (
            agent_id, agent_commission, franchise_commission, status,
            lifecycle_status, reconciliation_status, validated_at, validated_by,
            gross_supplier_commission, commercial_net_amount,
            franchise_royalty_amount, central_remainder_amount
        ) VALUES (
            v_commercial_id, 100, 0, 'cleared',
            'validated', 'ready', clock_timestamp(), v_admin_id,
            100, 100, 0, 0
        ) RETURNING id INTO v_commission_id;
    END IF;

    UPDATE public.profiles
    SET nif_cif = 'B12345678', fiscal_address = 'Verification 1', fiscal_city = 'Madrid',
        fiscal_province = 'Madrid', fiscal_postal_code = '28001', fiscal_country = 'España',
        iban = 'ES9121000418450200051332', company_name = 'Verification Commercial',
        company_type = 'sociedad_limitada', invoice_prefix = 'VERIFY', retention_percent = 0,
        invoice_tax_percent = 21, fiscal_verified = true, fiscal_verified_at = clock_timestamp()
    WHERE id = v_commercial_id;

    PERFORM public.configure_fiscal_organization(
        v_admin_id, 'Verification Zinergia', 'B87654321', 'Verification Central 1',
        'Madrid', '28001', 'España'
    );

    UPDATE public.network_commissions
    SET lifecycle_status = 'validated', reconciliation_status = 'ready',
        invoice_id = NULL, invoiced = false, lifecycle_invoiced_at = NULL,
        lifecycle_paid_at = NULL, paid_date = NULL
    WHERE id = v_commission_id;

    SELECT id INTO v_agreement_id
    FROM public.self_billing_agreements agreement
    WHERE agreement.commercial_id = v_commercial_id AND agreement.revoked_at IS NULL
    FOR UPDATE;

    IF v_agreement_id IS NULL THEN
        v_agreement_id := public.propose_self_billing_agreement(
            v_commercial_id, v_admin_id, 'VERIFY-' || txid_current()::text,
            'Transactional self-billing verification'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.self_billing_agreements WHERE id = v_agreement_id AND accepted_at IS NOT NULL) THEN
        PERFORM public.accept_self_billing_agreement(v_agreement_id, v_commercial_id);
    END IF;

    v_first_invoice_id := public.create_commission_invoice_draft(v_commercial_id, ARRAY[v_commission_id], v_admin_id);
    SELECT * INTO source_invoice FROM public.invoices WHERE id = v_first_invoice_id;
    IF NOT source_invoice.self_billing OR source_invoice.acceptance_status <> 'pending'
       OR source_invoice.issuer_nif <> 'B12345678' OR source_invoice.recipient_nif <> 'B87654321'
       OR source_invoice.total <> source_invoice.subtotal + source_invoice.tax_amount - source_invoice.retention_total
    THEN
        RAISE EXCEPTION 'draft direction, consent or totals are incorrect';
    END IF;

    BEGIN
        PERFORM public.create_commission_invoice_draft(v_commercial_id, ARRAY[v_commission_id], v_admin_id);
    EXCEPTION WHEN check_violation OR unique_violation THEN
        duplicate_denied := true;
    END;
    IF NOT duplicate_denied THEN RAISE EXCEPTION 'duplicate commission billing was not denied'; END IF;

    PERFORM public.accept_self_billed_invoice(v_first_invoice_id, v_commercial_id);
    PERFORM public.transition_fiscal_invoice(v_first_invoice_id, 'cancelled', v_admin_id, 'Transactional cancellation');
    IF EXISTS (SELECT 1 FROM public.network_commissions WHERE id = v_commission_id AND invoice_id IS NOT NULL) THEN
        RAISE EXCEPTION 'draft cancellation did not release the commission';
    END IF;

    v_issued_invoice_id := public.create_commission_invoice_draft(v_commercial_id, ARRAY[v_commission_id], v_admin_id);
    PERFORM public.accept_self_billed_invoice(v_issued_invoice_id, v_commercial_id);
    PERFORM public.transition_fiscal_invoice(v_issued_invoice_id, 'issued', v_admin_id, 'Transactional issue');
    IF NOT EXISTS (SELECT 1 FROM public.network_commissions WHERE id = v_commission_id AND lifecycle_status = 'invoiced') THEN
        RAISE EXCEPTION 'invoice issue did not synchronize the commission';
    END IF;
    PERFORM public.transition_fiscal_invoice(
        v_issued_invoice_id, 'paid', v_admin_id, 'Transactional payment', 'transferencia', 'VERIFY-PAYMENT'
    );
    IF NOT EXISTS (SELECT 1 FROM public.network_commissions WHERE id = v_commission_id AND lifecycle_status = 'paid') THEN
        RAISE EXCEPTION 'invoice payment did not synchronize the commission';
    END IF;

    INSERT INTO public.commission_adjustments (
        commission_id, reason_code, reversal_bps, gross_amount, commercial_amount,
        franchise_amount, central_amount, evidence_reference, policy_snapshot, proposed_by
    ) VALUES (
        v_commission_id, 'supplier_correction', 1, 0.01, 0.01, 0, 0,
        'VERIFY-ADJUSTMENT', '{"verification":true}'::jsonb, v_admin_id
    ) RETURNING id INTO v_adjustment_id;
    PERFORM public.resolve_commission_adjustment(v_adjustment_id, v_admin_id, 'confirmed', 'Transactional confirmation');

    SELECT id INTO v_rectification_request_id
    FROM public.fiscal_rectification_requests request WHERE request.adjustment_id = v_adjustment_id;
    IF v_rectification_request_id IS NULL THEN RAISE EXCEPTION 'confirmed paid adjustment did not queue rectification'; END IF;

    v_rectifying_invoice_id := public.create_rectifying_invoice_draft(v_rectification_request_id, v_admin_id);
    IF NOT EXISTS (
        SELECT 1 FROM public.invoices
        WHERE id = v_rectifying_invoice_id AND source_invoice_id = v_issued_invoice_id
          AND document_kind = 'rectifying_invoice' AND total < 0
    ) THEN
        RAISE EXCEPTION 'rectifying invoice is not linked or negative';
    END IF;
    PERFORM public.accept_self_billed_invoice(v_rectifying_invoice_id, v_commercial_id);
    PERFORM public.transition_fiscal_invoice(v_rectifying_invoice_id, 'issued', v_admin_id, 'Transactional rectification');
END;
$$;

ROLLBACK;

SELECT 'ok' AS atomic_fiscal_invoicing_transaction_verification;

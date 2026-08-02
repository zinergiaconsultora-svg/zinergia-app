BEGIN;

ALTER TABLE public.profiles
    ADD COLUMN invoice_tax_percent numeric(5,2),
    ADD CONSTRAINT profiles_invoice_tax_percent_check CHECK (
        invoice_tax_percent IS NULL OR invoice_tax_percent BETWEEN 0 AND 100
    );

CREATE OR REPLACE FUNCTION private.guard_fiscal_profile_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF coalesce(auth.role(), '') <> 'service_role' AND (
        NEW.nif_cif IS DISTINCT FROM OLD.nif_cif
        OR NEW.fiscal_address IS DISTINCT FROM OLD.fiscal_address
        OR NEW.fiscal_city IS DISTINCT FROM OLD.fiscal_city
        OR NEW.fiscal_province IS DISTINCT FROM OLD.fiscal_province
        OR NEW.fiscal_postal_code IS DISTINCT FROM OLD.fiscal_postal_code
        OR NEW.fiscal_country IS DISTINCT FROM OLD.fiscal_country
        OR NEW.iban IS DISTINCT FROM OLD.iban
        OR NEW.company_name IS DISTINCT FROM OLD.company_name
        OR NEW.company_type IS DISTINCT FROM OLD.company_type
        OR NEW.invoice_prefix IS DISTINCT FROM OLD.invoice_prefix
        OR NEW.retention_percent IS DISTINCT FROM OLD.retention_percent
        OR NEW.invoice_tax_percent IS DISTINCT FROM OLD.invoice_tax_percent
        OR NEW.fiscal_verified IS DISTINCT FROM OLD.fiscal_verified
        OR NEW.fiscal_verified_at IS DISTINCT FROM OLD.fiscal_verified_at
    ) THEN
        RAISE EXCEPTION 'fiscal profile mutations require the protected server action' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_fiscal_profile_mutation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION private.guard_fiscal_profile_mutation();

CREATE TABLE public.fiscal_organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name text NOT NULL CHECK (length(btrim(legal_name)) BETWEEN 2 AND 160),
    nif text NOT NULL CHECK (length(btrim(nif)) BETWEEN 3 AND 32),
    fiscal_address text NOT NULL CHECK (length(btrim(fiscal_address)) BETWEEN 3 AND 240),
    fiscal_city text NOT NULL CHECK (length(btrim(fiscal_city)) BETWEEN 2 AND 120),
    fiscal_postal_code text NOT NULL CHECK (length(btrim(fiscal_postal_code)) BETWEEN 3 AND 16),
    fiscal_country text NOT NULL DEFAULT 'España',
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fiscal_organizations_one_active_idx
    ON public.fiscal_organizations ((is_active)) WHERE is_active;

CREATE TABLE public.self_billing_agreements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commercial_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    agreement_reference text NOT NULL CHECK (length(btrim(agreement_reference)) BETWEEN 3 AND 120),
    scope_description text NOT NULL CHECK (length(btrim(scope_description)) BETWEEN 3 AND 500),
    proposed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    proposed_at timestamptz NOT NULL DEFAULT now(),
    accepted_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
    accepted_at timestamptz,
    revoked_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
    revoked_at timestamptz,
    revocation_reason text,
    CONSTRAINT self_billing_acceptance_consistent_check CHECK (
        (accepted_at IS NULL AND accepted_by IS NULL)
        OR (accepted_at IS NOT NULL AND accepted_by = commercial_id)
    ),
    CONSTRAINT self_billing_revocation_consistent_check CHECK (
        (revoked_at IS NULL AND revoked_by IS NULL)
        OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND length(btrim(revocation_reason)) >= 3)
    )
);

CREATE UNIQUE INDEX self_billing_one_current_idx
    ON public.self_billing_agreements (commercial_id) WHERE revoked_at IS NULL;

CREATE TABLE public.fiscal_document_sequences (
    issuer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    series text NOT NULL,
    fiscal_year integer NOT NULL,
    next_number integer NOT NULL DEFAULT 1 CHECK (next_number > 0),
    PRIMARY KEY (issuer_id, series, fiscal_year)
);

ALTER TABLE public.invoices
    ADD COLUMN document_kind text,
    ADD COLUMN source_invoice_id uuid REFERENCES public.invoices(id) ON DELETE RESTRICT,
    ADD COLUMN self_billing boolean NOT NULL DEFAULT false,
    ADD COLUMN self_billing_agreement_id uuid REFERENCES public.self_billing_agreements(id) ON DELETE RESTRICT,
    ADD COLUMN acceptance_status text NOT NULL DEFAULT 'not_required',
    ADD COLUMN accepted_at timestamptz,
    ADD COLUMN accepted_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD COLUMN rectification_reason text,
    ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD COLUMN cancelled_at timestamptz,
    ADD COLUMN cancelled_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD COLUMN cancellation_reason text;

UPDATE public.invoices SET document_kind = 'legacy_unverified' WHERE document_kind IS NULL;

ALTER TABLE public.invoices
    ALTER COLUMN document_kind SET NOT NULL,
    ALTER COLUMN document_kind SET DEFAULT 'collaborator_invoice',
    ADD CONSTRAINT invoices_document_kind_check CHECK (
        document_kind IN ('legacy_unverified', 'collaborator_invoice', 'rectifying_invoice')
    ),
    ADD CONSTRAINT invoices_acceptance_status_check CHECK (
        acceptance_status IN ('not_required', 'pending', 'accepted')
    ),
    ADD CONSTRAINT invoices_self_billing_consistent_check CHECK (
        (self_billing = false AND self_billing_agreement_id IS NULL AND acceptance_status = 'not_required')
        OR (self_billing = true AND self_billing_agreement_id IS NOT NULL AND acceptance_status IN ('pending', 'accepted'))
        OR document_kind = 'legacy_unverified'
    ),
    ADD CONSTRAINT invoices_rectifying_link_check CHECK (
        (document_kind = 'rectifying_invoice' AND source_invoice_id IS NOT NULL AND length(btrim(rectification_reason)) >= 3)
        OR (document_kind <> 'rectifying_invoice' AND source_invoice_id IS NULL)
    );

CREATE TABLE public.fiscal_invoice_commission_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    commission_id uuid NOT NULL REFERENCES public.network_commissions(id) ON DELETE RESTRICT,
    adjustment_id uuid REFERENCES public.commission_adjustments(id) ON DELETE RESTRICT,
    description text NOT NULL CHECK (length(btrim(description)) BETWEEN 3 AND 500),
    base_amount numeric(12,2) NOT NULL,
    tax_percent numeric(5,2) NOT NULL CHECK (tax_percent BETWEEN 0 AND 100),
    tax_amount numeric(12,2) NOT NULL,
    retention_percent numeric(5,2) NOT NULL CHECK (retention_percent BETWEEN 0 AND 100),
    retention_amount numeric(12,2) NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    released_at timestamptz,
    CONSTRAINT fiscal_invoice_line_kind_check CHECK (
        (adjustment_id IS NULL AND base_amount > 0 AND tax_amount >= 0 AND retention_amount >= 0 AND total_amount > 0)
        OR (adjustment_id IS NOT NULL AND base_amount < 0 AND tax_amount <= 0 AND retention_amount <= 0 AND total_amount < 0)
    )
);

CREATE UNIQUE INDEX fiscal_invoice_active_commission_idx
    ON public.fiscal_invoice_commission_lines (commission_id)
    WHERE adjustment_id IS NULL AND released_at IS NULL;
CREATE UNIQUE INDEX fiscal_invoice_adjustment_idx
    ON public.fiscal_invoice_commission_lines (adjustment_id)
    WHERE adjustment_id IS NOT NULL;
CREATE INDEX fiscal_invoice_lines_invoice_idx
    ON public.fiscal_invoice_commission_lines (invoice_id);

CREATE TABLE public.fiscal_rectification_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id uuid NOT NULL UNIQUE REFERENCES public.commission_adjustments(id) ON DELETE RESTRICT,
    commission_id uuid NOT NULL REFERENCES public.network_commissions(id) ON DELETE RESTRICT,
    source_invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    rectifying_invoice_id uuid UNIQUE REFERENCES public.invoices(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'drafted', 'issued', 'settled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE OR REPLACE FUNCTION private.next_fiscal_document_number(
    p_issuer_id uuid,
    p_series text,
    p_at date DEFAULT current_date
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    fiscal_year integer := extract(year from p_at)::integer;
    allocated integer;
BEGIN
    SELECT coalesce(max((regexp_match(invoice.invoice_number, '([0-9]+)$'))[1]::integer), 0) + 1
    INTO allocated
    FROM public.invoices invoice
    WHERE invoice.agent_id = p_issuer_id
      AND invoice.invoice_number LIKE upper(p_series) || '-' || fiscal_year::text || '-%';

    INSERT INTO public.fiscal_document_sequences (issuer_id, series, fiscal_year, next_number)
    VALUES (p_issuer_id, p_series, fiscal_year, allocated + 1)
    ON CONFLICT (issuer_id, series, fiscal_year) DO UPDATE
        SET next_number = public.fiscal_document_sequences.next_number + 1
    RETURNING next_number - 1 INTO allocated;

    RETURN upper(p_series) || '-' || fiscal_year::text || '-' || lpad(allocated::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.propose_self_billing_agreement(
    p_commercial_id uuid,
    p_actor_id uuid,
    p_agreement_reference text,
    p_scope_description text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE agreement_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin')
       OR p_commercial_id = p_actor_id
       OR length(btrim(coalesce(p_agreement_reference, ''))) < 3
       OR length(btrim(coalesce(p_scope_description, ''))) < 3
    THEN RAISE EXCEPTION 'self-billing agreement proposal unavailable' USING ERRCODE = '42501'; END IF;

    INSERT INTO public.self_billing_agreements (
        commercial_id, agreement_reference, scope_description, proposed_by
    ) VALUES (
        p_commercial_id, btrim(p_agreement_reference), btrim(p_scope_description), p_actor_id
    ) RETURNING id INTO agreement_id;
    RETURN agreement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.configure_fiscal_organization(
    p_actor_id uuid,
    p_legal_name text,
    p_nif text,
    p_fiscal_address text,
    p_fiscal_city text,
    p_fiscal_postal_code text,
    p_fiscal_country text DEFAULT 'España'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE organization_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin')
       OR length(btrim(coalesce(p_legal_name, ''))) < 2
       OR length(btrim(coalesce(p_nif, ''))) < 3
       OR length(btrim(coalesce(p_fiscal_address, ''))) < 3
       OR length(btrim(coalesce(p_fiscal_city, ''))) < 2
       OR length(btrim(coalesce(p_fiscal_postal_code, ''))) < 3
       OR length(btrim(coalesce(p_fiscal_country, ''))) < 2
    THEN
        RAISE EXCEPTION 'fiscal organization configuration unavailable' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO organization_id
    FROM public.fiscal_organizations
    WHERE is_active
    FOR UPDATE;

    IF organization_id IS NULL THEN
        INSERT INTO public.fiscal_organizations (
            legal_name, nif, fiscal_address, fiscal_city, fiscal_postal_code,
            fiscal_country, created_by
        ) VALUES (
            btrim(p_legal_name), upper(btrim(p_nif)), btrim(p_fiscal_address),
            btrim(p_fiscal_city), btrim(p_fiscal_postal_code),
            btrim(p_fiscal_country), p_actor_id
        ) RETURNING id INTO organization_id;
    ELSE
        UPDATE public.fiscal_organizations
        SET legal_name = btrim(p_legal_name),
            nif = upper(btrim(p_nif)),
            fiscal_address = btrim(p_fiscal_address),
            fiscal_city = btrim(p_fiscal_city),
            fiscal_postal_code = btrim(p_fiscal_postal_code),
            fiscal_country = btrim(p_fiscal_country),
            updated_at = clock_timestamp()
        WHERE id = organization_id;
    END IF;

    RETURN organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_self_billing_agreement(p_agreement_id uuid, p_actor_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.self_billing_agreements
    SET accepted_by = p_actor_id, accepted_at = clock_timestamp()
    WHERE id = p_agreement_id AND commercial_id = p_actor_id
      AND accepted_at IS NULL AND revoked_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'self-billing agreement acceptance unavailable' USING ERRCODE = '42501'; END IF;
    RETURN p_agreement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_self_billing_agreement(
    p_agreement_id uuid,
    p_actor_id uuid,
    p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF length(btrim(coalesce(p_reason, ''))) < 3
       OR NOT EXISTS (
           SELECT 1
           FROM public.self_billing_agreements agreement
           LEFT JOIN public.profiles actor ON actor.id = p_actor_id
           WHERE agreement.id = p_agreement_id
             AND agreement.revoked_at IS NULL
             AND (agreement.commercial_id = p_actor_id OR actor.role = 'admin')
       )
    THEN
        RAISE EXCEPTION 'self-billing agreement revocation unavailable' USING ERRCODE = '42501';
    END IF;

    UPDATE public.self_billing_agreements
    SET revoked_by = p_actor_id, revoked_at = clock_timestamp(), revocation_reason = btrim(p_reason)
    WHERE id = p_agreement_id AND revoked_at IS NULL;
    RETURN p_agreement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_fiscal_admin_setup(p_actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin') THEN
        RAISE EXCEPTION 'fiscal administration unavailable' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'organization', (
            SELECT to_jsonb(organization)
            FROM public.fiscal_organizations organization
            WHERE organization.is_active
        ),
        'agreements', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', agreement.id,
                'commercialId', agreement.commercial_id,
                'commercialName', coalesce(commercial.full_name, commercial.email, 'Comercial'),
                'reference', agreement.agreement_reference,
                'scope', agreement.scope_description,
                'proposedAt', agreement.proposed_at,
                'acceptedAt', agreement.accepted_at,
                'revokedAt', agreement.revoked_at,
                'revocationReason', agreement.revocation_reason
            ) ORDER BY agreement.proposed_at DESC)
            FROM public.self_billing_agreements agreement
            JOIN public.profiles commercial ON commercial.id = agreement.commercial_id
        ), '[]'::jsonb)
    ) INTO result;
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_self_billing_status(p_actor_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT coalesce((
        SELECT jsonb_build_object(
            'id', agreement.id,
            'reference', agreement.agreement_reference,
            'scope', agreement.scope_description,
            'proposedAt', agreement.proposed_at,
            'acceptedAt', agreement.accepted_at
        )
        FROM public.self_billing_agreements agreement
        WHERE agreement.commercial_id = p_actor_id AND agreement.revoked_at IS NULL
    ), 'null'::jsonb)
    WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id);
$$;

CREATE OR REPLACE FUNCTION public.create_commission_invoice_draft(
    p_commercial_id uuid,
    p_commission_ids uuid[],
    p_actor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    actor_role text;
    commercial public.profiles%ROWTYPE;
    organization public.fiscal_organizations%ROWTYPE;
    agreement public.self_billing_agreements%ROWTYPE;
    created_invoice_id uuid;
    invoice_number text;
    series text;
    is_self_billing boolean;
    selected_count integer;
    subtotal numeric(12,2);
    tax_amount numeric(12,2);
    retention_amount numeric(12,2);
    total_amount numeric(12,2);
BEGIN
    SELECT role INTO actor_role FROM public.profiles WHERE id = p_actor_id;
    is_self_billing := actor_role = 'admin' AND p_actor_id <> p_commercial_id;
    IF actor_role IS NULL OR (p_actor_id <> p_commercial_id AND actor_role <> 'admin')
       OR p_commission_ids IS NULL OR cardinality(p_commission_ids) = 0
       OR cardinality(p_commission_ids) <> (SELECT count(DISTINCT value) FROM unnest(p_commission_ids) value)
    THEN RAISE EXCEPTION 'fiscal draft unavailable' USING ERRCODE = '42501'; END IF;

    SELECT * INTO commercial FROM public.profiles WHERE id = p_commercial_id FOR UPDATE;
    SELECT * INTO organization FROM public.fiscal_organizations WHERE is_active;
    IF commercial.id IS NULL OR commercial.fiscal_verified IS NOT TRUE
       OR commercial.nif_cif IS NULL OR commercial.fiscal_address IS NULL
       OR commercial.fiscal_city IS NULL OR commercial.fiscal_postal_code IS NULL
       OR commercial.invoice_tax_percent IS NULL OR organization.id IS NULL
    THEN RAISE EXCEPTION 'fiscal configuration incomplete' USING ERRCODE = '23514'; END IF;

    IF is_self_billing THEN
        SELECT * INTO agreement FROM public.self_billing_agreements
        WHERE commercial_id = p_commercial_id AND accepted_at IS NOT NULL AND revoked_at IS NULL
        FOR UPDATE;
        IF agreement.id IS NULL THEN RAISE EXCEPTION 'accepted self-billing agreement required' USING ERRCODE = '23514'; END IF;
    END IF;

    PERFORM 1 FROM public.network_commissions
    WHERE id = ANY(p_commission_ids) ORDER BY id FOR UPDATE;

    SELECT count(*),
        round(sum(commercial_net_amount - total_reversed_commercial), 2),
        round(sum(round((commercial_net_amount - total_reversed_commercial) * commercial.invoice_tax_percent / 100.0, 2)), 2),
        round(sum(round((commercial_net_amount - total_reversed_commercial) * coalesce(commercial.retention_percent, 0) / 100.0, 2)), 2)
    INTO selected_count, subtotal, tax_amount, retention_amount
    FROM public.network_commissions
    WHERE id = ANY(p_commission_ids)
      AND agent_id = p_commercial_id
      AND lifecycle_status = 'validated'
      AND reconciliation_status = 'ready'
      AND invoice_id IS NULL
      AND commercial_net_amount - total_reversed_commercial > 0;

    IF selected_count <> cardinality(p_commission_ids) THEN
        RAISE EXCEPTION 'commissions are not eligible for one fiscal draft' USING ERRCODE = '23514';
    END IF;

    total_amount := subtotal + tax_amount - retention_amount;
    series := CASE WHEN is_self_billing THEN 'AUTO-' ELSE '' END || coalesce(commercial.invoice_prefix, 'FAC');
    invoice_number := private.next_fiscal_document_number(commercial.id, series);

    INSERT INTO public.invoices (
        invoice_number, agent_id, franchise_id, issuer_name, issuer_nif, issuer_address,
        issuer_city, issuer_postal_code, recipient_name, recipient_nif, recipient_address,
        recipient_city, recipient_postal_code, due_date, subtotal, retention_total,
        retention_percent, tax_base, tax_type, tax_percent, tax_amount, total, status,
        document_kind, self_billing, self_billing_agreement_id, acceptance_status, created_by
    ) VALUES (
        invoice_number, commercial.id, commercial.franchise_id,
        coalesce(commercial.company_name, commercial.full_name, commercial.email), commercial.nif_cif,
        commercial.fiscal_address, commercial.fiscal_city, commercial.fiscal_postal_code,
        organization.legal_name, organization.nif, organization.fiscal_address,
        organization.fiscal_city, organization.fiscal_postal_code, current_date + 30,
        subtotal, retention_amount, coalesce(commercial.retention_percent, 0), subtotal,
        'IVA', commercial.invoice_tax_percent, tax_amount, total_amount, 'draft',
        'collaborator_invoice', is_self_billing, agreement.id,
        CASE WHEN is_self_billing THEN 'pending' ELSE 'not_required' END, p_actor_id
    ) RETURNING id INTO created_invoice_id;

    INSERT INTO public.fiscal_invoice_commission_lines (
        invoice_id, commission_id, description, base_amount, tax_percent, tax_amount,
        retention_percent, retention_amount, total_amount
    )
    SELECT created_invoice_id, commission.id, 'Comisión comercial · ' || coalesce(client.name, 'Cliente'),
        round(commission.commercial_net_amount - commission.total_reversed_commercial, 2),
        commercial.invoice_tax_percent,
        round((commission.commercial_net_amount - commission.total_reversed_commercial) * commercial.invoice_tax_percent / 100.0, 2),
        coalesce(commercial.retention_percent, 0),
        round((commission.commercial_net_amount - commission.total_reversed_commercial) * coalesce(commercial.retention_percent, 0) / 100.0, 2),
        round(commission.commercial_net_amount - commission.total_reversed_commercial, 2)
            + round((commission.commercial_net_amount - commission.total_reversed_commercial) * commercial.invoice_tax_percent / 100.0, 2)
            - round((commission.commercial_net_amount - commission.total_reversed_commercial) * coalesce(commercial.retention_percent, 0) / 100.0, 2)
    FROM public.network_commissions commission
    LEFT JOIN public.clients client ON client.id = commission.client_id
    WHERE commission.id = ANY(p_commission_ids);

    UPDATE public.invoices fiscal_invoice
    SET invoice_lines = (
        SELECT jsonb_agg(jsonb_build_object(
            'description', line.description,
            'commission_id', line.commission_id,
            'base_amount', line.base_amount,
            'tax_amount', line.tax_amount,
            'retention', line.retention_amount,
            'total_line', line.total_amount
        ) ORDER BY line.id)
        FROM public.fiscal_invoice_commission_lines line
        WHERE line.invoice_id = created_invoice_id
    )
    WHERE fiscal_invoice.id = created_invoice_id;

    UPDATE public.network_commissions commission
    SET invoice_id = created_invoice_id
    WHERE id = ANY(p_commission_ids);
    RETURN created_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_self_billed_invoice(p_invoice_id uuid, p_actor_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    UPDATE public.invoices fiscal_invoice
    SET acceptance_status = 'accepted', accepted_at = clock_timestamp(), accepted_by = p_actor_id
    WHERE fiscal_invoice.id = p_invoice_id AND fiscal_invoice.agent_id = p_actor_id AND fiscal_invoice.status = 'draft'
      AND fiscal_invoice.self_billing AND fiscal_invoice.acceptance_status = 'pending'
      AND EXISTS (
          SELECT 1 FROM public.self_billing_agreements agreement
          WHERE agreement.id = fiscal_invoice.self_billing_agreement_id
            AND agreement.accepted_at IS NOT NULL AND agreement.revoked_at IS NULL
      );
    IF NOT FOUND THEN RAISE EXCEPTION 'self-billed invoice acceptance unavailable' USING ERRCODE = '42501'; END IF;
    RETURN p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_fiscal_invoice(
    p_invoice_id uuid, p_to_status text, p_actor_id uuid, p_reason text,
    p_payment_method text DEFAULT NULL, p_payment_reference text DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE invoice public.invoices%ROWTYPE; actor_role text; transition_at timestamptz := clock_timestamp();
    affected_count integer; expected_count integer;
BEGIN
    SELECT role INTO actor_role FROM public.profiles WHERE id = p_actor_id;
    SELECT * INTO invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
    IF invoice.id IS NULL OR length(btrim(coalesce(p_reason, ''))) < 3 THEN
        RAISE EXCEPTION 'fiscal transition unavailable' USING ERRCODE = '22023';
    END IF;

    IF p_to_status = 'issued' THEN
        IF invoice.status <> 'draft'
           OR (invoice.self_billing AND (actor_role <> 'admin' OR invoice.acceptance_status <> 'accepted'))
           OR (invoice.self_billing AND NOT EXISTS (
               SELECT 1 FROM public.self_billing_agreements agreement
               WHERE agreement.id = invoice.self_billing_agreement_id
                 AND agreement.accepted_at IS NOT NULL AND agreement.revoked_at IS NULL
           ))
           OR (NOT invoice.self_billing AND p_actor_id <> invoice.agent_id)
        THEN RAISE EXCEPTION 'invoice issue unavailable' USING ERRCODE = '42501'; END IF;
        UPDATE public.invoices SET status = 'issued', issue_date = current_date WHERE id = invoice.id;
        IF invoice.document_kind = 'collaborator_invoice' THEN
            SELECT count(*) INTO expected_count
            FROM public.fiscal_invoice_commission_lines line
            WHERE line.invoice_id = invoice.id AND line.adjustment_id IS NULL AND line.released_at IS NULL;
            UPDATE public.network_commissions SET lifecycle_status = 'invoiced', invoiced = true,
                lifecycle_invoiced_at = transition_at
            WHERE invoice_id = invoice.id AND lifecycle_status = 'validated';
            GET DIAGNOSTICS affected_count = ROW_COUNT;
            IF affected_count <> expected_count OR expected_count = 0 THEN
                RAISE EXCEPTION 'invoice commission transition incomplete' USING ERRCODE = '23514';
            END IF;
            INSERT INTO public.commission_events (commission_id, event_type, from_status, to_status, actor_id, reason_code, idempotency_key)
            SELECT commission_id, 'invoiced', 'validated', 'invoiced', p_actor_id, btrim(p_reason), 'fiscal-invoice:' || invoice.id::text
            FROM public.fiscal_invoice_commission_lines WHERE invoice_id = invoice.id AND adjustment_id IS NULL;
        ELSE
            UPDATE public.fiscal_rectification_requests SET status = 'issued' WHERE rectifying_invoice_id = invoice.id;
        END IF;
    ELSIF p_to_status = 'cancelled' THEN
        IF invoice.status <> 'draft' OR (invoice.self_billing AND actor_role <> 'admin')
           OR (NOT invoice.self_billing AND p_actor_id <> invoice.agent_id)
        THEN RAISE EXCEPTION 'invoice cancellation unavailable' USING ERRCODE = '42501'; END IF;
        UPDATE public.invoices SET status = 'cancelled', cancelled_at = transition_at,
            cancelled_by = p_actor_id, cancellation_reason = btrim(p_reason) WHERE id = invoice.id;
        UPDATE public.fiscal_invoice_commission_lines SET released_at = transition_at
        WHERE invoice_id = invoice.id AND adjustment_id IS NULL AND released_at IS NULL;
        UPDATE public.network_commissions SET invoice_id = NULL
        WHERE invoice_id = invoice.id AND lifecycle_status = 'validated';
        IF invoice.document_kind = 'rectifying_invoice' THEN
            DELETE FROM public.fiscal_invoice_commission_lines line
            WHERE line.invoice_id = invoice.id AND line.adjustment_id IS NOT NULL;
            UPDATE public.fiscal_rectification_requests
            SET status = 'pending', rectifying_invoice_id = NULL
            WHERE rectifying_invoice_id = invoice.id AND status = 'drafted';
        END IF;
    ELSIF p_to_status = 'paid' THEN
        IF invoice.status <> 'issued' OR actor_role <> 'admin' OR p_payment_method IS NULL
           OR length(btrim(coalesce(p_payment_reference, ''))) < 3 THEN
            RAISE EXCEPTION 'invoice payment unavailable' USING ERRCODE = '42501'; END IF;
        UPDATE public.invoices SET status = 'paid', paid_date = current_date,
            payment_method = p_payment_method, payment_reference = p_payment_reference WHERE id = invoice.id;
        IF invoice.document_kind = 'collaborator_invoice' THEN
            SELECT count(*) INTO expected_count
            FROM public.fiscal_invoice_commission_lines line
            WHERE line.invoice_id = invoice.id AND line.adjustment_id IS NULL AND line.released_at IS NULL;
            UPDATE public.network_commissions SET lifecycle_status = 'paid', status = 'paid',
                lifecycle_paid_at = transition_at, paid_date = current_date
            WHERE invoice_id = invoice.id AND lifecycle_status = 'invoiced';
            GET DIAGNOSTICS affected_count = ROW_COUNT;
            IF affected_count <> expected_count OR expected_count = 0 THEN
                RAISE EXCEPTION 'payment commission transition incomplete' USING ERRCODE = '23514';
            END IF;
            INSERT INTO public.commission_events (commission_id, event_type, from_status, to_status, actor_id, reason_code, idempotency_key)
            SELECT commission_id, 'paid', 'invoiced', 'paid', p_actor_id, btrim(p_reason), 'fiscal-payment:' || invoice.id::text
            FROM public.fiscal_invoice_commission_lines WHERE invoice_id = invoice.id AND adjustment_id IS NULL;
        ELSE
            UPDATE public.fiscal_rectification_requests SET status = 'settled', completed_at = transition_at WHERE rectifying_invoice_id = invoice.id;
        END IF;
    ELSE RAISE EXCEPTION 'invalid fiscal transition' USING ERRCODE = '23514'; END IF;
    RETURN p_to_status;
END;
$$;

CREATE OR REPLACE FUNCTION private.queue_rectification_request()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE source_id uuid;
BEGIN
    IF NEW.status = 'confirmed' AND OLD.status = 'proposed' AND NEW.commercial_amount > 0 THEN
        SELECT invoice.id INTO source_id
        FROM public.network_commissions commission
        JOIN public.invoices invoice ON invoice.id = commission.invoice_id
        WHERE commission.id = NEW.commission_id AND invoice.status IN ('issued', 'paid');
        IF source_id IS NOT NULL THEN
            INSERT INTO public.fiscal_rectification_requests (adjustment_id, commission_id, source_invoice_id)
            VALUES (NEW.id, NEW.commission_id, source_id) ON CONFLICT (adjustment_id) DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER queue_fiscal_rectification_after_adjustment
    AFTER UPDATE OF status ON public.commission_adjustments
    FOR EACH ROW EXECUTE FUNCTION private.queue_rectification_request();

CREATE OR REPLACE FUNCTION public.create_rectifying_invoice_draft(p_request_id uuid, p_actor_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE request public.fiscal_rectification_requests%ROWTYPE; source public.invoices%ROWTYPE;
    adjustment public.commission_adjustments%ROWTYPE; actor_role text; created_invoice_id uuid;
    number text; series text; base numeric(12,2); tax numeric(12,2); retention numeric(12,2); total numeric(12,2);
BEGIN
    SELECT role INTO actor_role FROM public.profiles WHERE id = p_actor_id;
    SELECT * INTO request FROM public.fiscal_rectification_requests WHERE id = p_request_id FOR UPDATE;
    SELECT * INTO source FROM public.invoices WHERE id = request.source_invoice_id FOR UPDATE;
    SELECT * INTO adjustment FROM public.commission_adjustments WHERE id = request.adjustment_id;
    IF request.id IS NULL OR source.id IS NULL OR adjustment.id IS NULL
       OR request.status <> 'pending' OR source.status NOT IN ('issued', 'paid')
       OR (source.self_billing AND actor_role <> 'admin')
       OR (NOT source.self_billing AND p_actor_id <> source.agent_id)
    THEN RAISE EXCEPTION 'rectifying draft unavailable' USING ERRCODE = '42501'; END IF;

    base := -adjustment.commercial_amount;
    tax := round(base * source.tax_percent / 100.0, 2);
    retention := round(base * source.retention_percent / 100.0, 2);
    total := base + tax - retention;
    series := CASE WHEN source.self_billing THEN 'AUTO-RECT' ELSE 'RECT' END;
    number := private.next_fiscal_document_number(source.agent_id, series);

    INSERT INTO public.invoices (
        invoice_number, agent_id, franchise_id, issuer_name, issuer_nif, issuer_address,
        issuer_city, issuer_postal_code, recipient_name, recipient_nif, recipient_address,
        recipient_city, recipient_postal_code, due_date, subtotal, retention_total,
        retention_percent, tax_base, tax_type, tax_percent, tax_amount, total, status,
        document_kind, source_invoice_id, rectification_reason, self_billing,
        self_billing_agreement_id, acceptance_status, created_by
    ) VALUES (
        number, source.agent_id, source.franchise_id, source.issuer_name, source.issuer_nif,
        source.issuer_address, source.issuer_city, source.issuer_postal_code,
        source.recipient_name, source.recipient_nif, source.recipient_address,
        source.recipient_city, source.recipient_postal_code, current_date + 30,
        base, retention, source.retention_percent, base, source.tax_type, source.tax_percent,
        tax, total, 'draft', 'rectifying_invoice', source.id,
        adjustment.reason_code || ': ' || adjustment.evidence_reference,
        source.self_billing, source.self_billing_agreement_id,
        CASE WHEN source.self_billing THEN 'pending' ELSE 'not_required' END, p_actor_id
    ) RETURNING id INTO created_invoice_id;

    INSERT INTO public.fiscal_invoice_commission_lines (
        invoice_id, commission_id, adjustment_id, description, base_amount, tax_percent,
        tax_amount, retention_percent, retention_amount, total_amount
    ) VALUES (
        created_invoice_id, request.commission_id, request.adjustment_id,
        'Rectificación de ' || source.invoice_number || ' · ' || adjustment.reason_code,
        base, source.tax_percent, tax, source.retention_percent, retention, total
    );
    UPDATE public.invoices fiscal_invoice
    SET invoice_lines = jsonb_build_array(jsonb_build_object(
        'description', 'Rectificación de ' || source.invoice_number || ' · ' || adjustment.reason_code,
        'commission_id', request.commission_id,
        'base_amount', base,
        'tax_amount', tax,
        'retention', retention,
        'total_line', total
    ))
    WHERE fiscal_invoice.id = created_invoice_id;
    UPDATE public.fiscal_rectification_requests
    SET status = 'drafted', rectifying_invoice_id = created_invoice_id
    WHERE id = request.id;
    RETURN created_invoice_id;
END;
$$;

ALTER TABLE public.fiscal_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_billing_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_invoice_commission_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_rectification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY fiscal_organizations_admin_read ON public.fiscal_organizations FOR SELECT TO authenticated USING ((select private.is_admin()));
CREATE POLICY self_billing_agreements_scoped_read ON public.self_billing_agreements FOR SELECT TO authenticated USING (
    commercial_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.profiles commercial
        WHERE commercial.id = self_billing_agreements.commercial_id
          AND commercial.parent_id = (select auth.uid())
    )
    OR (select private.is_admin())
);
CREATE POLICY fiscal_lines_scoped_read ON public.fiscal_invoice_commission_lines FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM public.invoices invoice
        JOIN public.profiles commercial ON commercial.id = invoice.agent_id
        WHERE invoice.id = fiscal_invoice_commission_lines.invoice_id
          AND (
              invoice.agent_id = (select auth.uid())
              OR commercial.parent_id = (select auth.uid())
              OR (select private.is_admin())
          )
    )
);
CREATE POLICY rectification_requests_scoped_read ON public.fiscal_rectification_requests FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.network_commissions commission
        WHERE commission.id = fiscal_rectification_requests.commission_id
          AND (
              commission.agent_id = (select auth.uid())
              OR commission.franchise_id = (select auth.uid())
              OR (select private.is_admin())
          )
    )
);

-- Fiscal mutations are server-only. Legacy broad RLS policies are insufficient
-- protection when authenticated clients retain table privileges.
REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.invoices TO authenticated, service_role;
GRANT ALL ON public.invoices TO service_role;

REVOKE ALL ON public.fiscal_organizations, public.self_billing_agreements,
    public.fiscal_document_sequences, public.fiscal_invoice_commission_lines,
    public.fiscal_rectification_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fiscal_organizations, public.self_billing_agreements,
    public.fiscal_invoice_commission_lines, public.fiscal_rectification_requests TO authenticated, service_role;
GRANT ALL ON public.fiscal_organizations, public.self_billing_agreements,
    public.fiscal_document_sequences, public.fiscal_invoice_commission_lines,
    public.fiscal_rectification_requests TO service_role;

REVOKE ALL ON FUNCTION private.next_fiscal_document_number(uuid,text,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.queue_rectification_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_fiscal_profile_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.propose_self_billing_agreement(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.configure_fiscal_organization(uuid,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_self_billing_agreement(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_self_billing_agreement(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_fiscal_admin_setup(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_self_billing_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_commission_invoice_draft(uuid,uuid[],uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_self_billed_invoice(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_fiscal_invoice(uuid,text,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_rectifying_invoice_draft(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.next_fiscal_document_number(uuid,text,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.propose_self_billing_agreement(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.configure_fiscal_organization(uuid,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_self_billing_agreement(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_self_billing_agreement(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_fiscal_admin_setup(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_self_billing_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_commission_invoice_draft(uuid,uuid[],uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_self_billed_invoice(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_fiscal_invoice(uuid,text,uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_rectifying_invoice_draft(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.generate_invoice_number(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.fiscal_invoice_commission_lines IS 'Normalized fiscal lines; active uniqueness prevents billing one commission twice.';
COMMENT ON COLUMN public.invoices.self_billing IS 'True only when Zinergia creates the document in the commercial issuer name under an accepted agreement.';
COMMENT ON COLUMN public.invoices.source_invoice_id IS 'Mandatory original invoice link for rectifying documents.';

COMMIT;

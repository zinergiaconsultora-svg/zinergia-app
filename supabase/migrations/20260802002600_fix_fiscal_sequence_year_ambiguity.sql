BEGIN;

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
    v_fiscal_year integer := extract(year from p_at)::integer;
    v_allocated integer;
BEGIN
    SELECT coalesce(max((regexp_match(invoice.invoice_number, '([0-9]+)$'))[1]::integer), 0) + 1
    INTO v_allocated
    FROM public.invoices invoice
    WHERE invoice.agent_id = p_issuer_id
      AND invoice.invoice_number LIKE upper(p_series) || '-' || v_fiscal_year::text || '-%';

    INSERT INTO public.fiscal_document_sequences (issuer_id, series, fiscal_year, next_number)
    VALUES (p_issuer_id, p_series, v_fiscal_year, v_allocated + 1)
    ON CONFLICT (issuer_id, series, fiscal_year) DO UPDATE
        SET next_number = public.fiscal_document_sequences.next_number + 1
    RETURNING next_number - 1 INTO v_allocated;

    RETURN upper(p_series) || '-' || v_fiscal_year::text || '-' || lpad(v_allocated::text, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION private.next_fiscal_document_number(uuid,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.next_fiscal_document_number(uuid,text,date) TO service_role;

COMMIT;

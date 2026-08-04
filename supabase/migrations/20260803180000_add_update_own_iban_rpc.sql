-- ZIN-SDD-041 dedicated banking write boundary discovered during T10.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_own_iban(
    p_actor_id uuid,
    p_iban text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_iban text := upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g'));
    v_numeric text;
    v_remainder integer := 0;
    v_character text;
    v_index integer;
BEGIN
    IF p_actor_id IS NULL OR v_iban !~ '^ES[0-9]{22}$' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IBAN_INPUT_INVALID';
    END IF;

    -- ISO 13616 mod-97 representation for the fixed Spanish country prefix.
    v_numeric := substring(v_iban FROM 5) || '1428' || substring(v_iban FROM 3 FOR 2);
    FOR v_index IN 1..length(v_numeric) LOOP
        v_character := substring(v_numeric FROM v_index FOR 1);
        v_remainder := (v_remainder * 10 + v_character::integer) % 97;
    END LOOP;
    IF v_remainder <> 1 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IBAN_INPUT_INVALID';
    END IF;

    UPDATE public.profiles
    SET iban = v_iban,
        fiscal_verified = false,
        fiscal_verified_at = NULL
    WHERE id = p_actor_id
      AND role IN ('admin', 'franchise', 'agent');
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCOUNT_NOT_ACTIVE';
    END IF;
END;
$$;

ALTER FUNCTION public.update_own_iban(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_own_iban(uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_iban(uuid, text)
    TO service_role;

COMMENT ON FUNCTION public.update_own_iban(uuid, text) IS
    'Service-only own banking replacement; validates Spanish IBAN and invalidates fiscal verification atomically.';

COMMIT;

-- ZIN-SDD-041 staging verifier. The successful mutation is deliberately
-- reverted by a caught subtransaction exception; this statement never leaves
-- the fixture changed.
DO $verify_iban$
DECLARE
    v_id constant uuid := '__IBAN_PROFILE_ID__';
    v_old_iban text;
    v_old_verified boolean;
    v_old_verified_at timestamptz;
    v_rejected boolean := false;
BEGIN
    -- Direct database verification must emulate the service-role JWT claim that
    -- PostgREST supplies to the protected fiscal mutation guard.
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);

    SELECT iban, fiscal_verified, fiscal_verified_at
    INTO v_old_iban, v_old_verified, v_old_verified_at
    FROM public.profiles
    WHERE id = v_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'IBAN_VERIFY_FIXTURE_MISSING';
    END IF;

    BEGIN
        PERFORM public.update_own_iban(v_id, 'ES9121000418450200051332');
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_id
              AND iban = 'ES9121000418450200051332'
              AND fiscal_verified IS FALSE
              AND fiscal_verified_at IS NULL
        ) THEN
            RAISE EXCEPTION 'IBAN_VERIFY_POSTCONDITION_FAILED';
        END IF;
        RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'ROLLBACK_VALID_IBAN_PROBE';
    EXCEPTION WHEN SQLSTATE 'ZX001' THEN
        NULL;
    END;

    IF (SELECT iban FROM public.profiles WHERE id = v_id) IS DISTINCT FROM v_old_iban
       OR (SELECT fiscal_verified FROM public.profiles WHERE id = v_id) IS DISTINCT FROM v_old_verified
       OR (SELECT fiscal_verified_at FROM public.profiles WHERE id = v_id) IS DISTINCT FROM v_old_verified_at THEN
        RAISE EXCEPTION 'IBAN_VERIFY_ROLLBACK_FAILED';
    END IF;

    BEGIN
        PERFORM public.update_own_iban(v_id, 'ES0000000000000000000000');
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_rejected := SQLERRM = 'IBAN_INPUT_INVALID';
    END;
    IF NOT v_rejected THEN
        RAISE EXCEPTION 'IBAN_VERIFY_INVALID_ACCEPTED';
    END IF;

    IF has_function_privilege('authenticated', 'public.update_own_iban(uuid,text)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.update_own_iban(uuid,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'IBAN_VERIFY_ACL_FAILED';
    END IF;
END
$verify_iban$;

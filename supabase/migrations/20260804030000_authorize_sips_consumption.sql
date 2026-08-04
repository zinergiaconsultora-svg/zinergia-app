-- ZIN-SDD-043 slice 1: server-side authorization for SIPS annual-consumption reads.
--
-- Confirmed gap being closed: the annual-consumption route authenticated the caller and
-- then went straight to the service-role cache read and the CNMC request. It never touched
-- sips_consents, never checked the portfolio relationship and never checked role. Any
-- authenticated user could submit any valid Spanish CUPS and receive that supply point's
-- annual consumption - third-party personal data, without consent and without scope.
--
-- The decision lives here, in one SECURITY DEFINER function, for three reasons:
--   1. The route can call it with the user-scoped client, so no service client is created
--      before the request is authorized (REQ-001).
--   2. sips_consents RLS is `user_id = auth.uid()`, which cannot express franchise or admin
--      oversight. Widening that policy would grant broad row visibility; a boolean-only
--      function answers the question without exposing the rows.
--   3. One place holds the rule, so the cache path and the live path cannot drift (INV-002).
--
-- Consent is required for every role, including admin: oversight is not a substitute for
-- the customer's authorization (INV-004).

BEGIN;

CREATE OR REPLACE FUNCTION public.authorize_sips_consumption(p_cups_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor public.profiles%ROWTYPE;
    v_consent_id uuid;
BEGIN
    IF v_actor_id IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
    END IF;

    -- Blind index produced by hashCups(): HMAC-SHA-256 rendered as lowercase hex.
    IF p_cups_hash IS NULL OR p_cups_hash !~ '^[0-9a-f]{64,128}$' THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_reference');
    END IF;

    SELECT * INTO v_actor FROM public.profiles WHERE id = v_actor_id;
    IF NOT FOUND OR v_actor.role IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'account_not_active');
    END IF;

    -- One non-revoked consent for this exact supply, reachable by this actor.
    --
    -- `role = 'admin'` is deliberately not tightened to the canonical authority tuple here.
    -- This function answers a consent question, not an authority question, and denying a
    -- working admin over an unrelated tuple defect would be a regression.
    SELECT consent.id INTO v_consent_id
    FROM public.sips_consents AS consent
    LEFT JOIN public.clients AS client ON client.id = consent.client_id
    WHERE consent.cups_hash = p_cups_hash
      AND consent.revoked_at IS NULL
      AND (
          (
              consent.client_id IS NOT NULL
              AND client.id IS NOT NULL
              AND (
                  v_actor.role = 'admin'
                  OR (v_actor.role = 'franchise'
                      AND v_actor.franchise_id IS NOT NULL
                      AND client.franchise_id = v_actor.franchise_id)
                  OR (v_actor.role = 'agent' AND client.owner_id = v_actor_id)
              )
          )
          -- Prospecting: the supply is not a client yet, so the actor who captured the
          -- authorization is the one accountable for it. The consent row carries actor,
          -- source and timestamp, which is the evidence this flow exists to produce.
          OR (consent.client_id IS NULL AND consent.user_id = v_actor_id)
      )
    LIMIT 1;

    IF v_consent_id IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'no_active_consent');
    END IF;

    RETURN jsonb_build_object('allowed', true, 'reason', 'authorized');
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_sips_consumption(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_sips_consumption(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.authorize_sips_consumption(text) IS
    'ZIN-SDD-043: boolean-only SIPS authorization. Requires one non-revoked consent for the supply, reachable through the caller portfolio scope or captured by the caller. Returns a safe reason code and never returns consumption data or raw CUPS.';

-- Audit: a denial is an outcome worth investigating, and the existing status CHECK had no
-- value for it, so denials would simply not be recorded.
ALTER TABLE public.sips_query_audit
    DROP CONSTRAINT IF EXISTS sips_query_audit_status_check;

ALTER TABLE public.sips_query_audit
    ADD CONSTRAINT sips_query_audit_status_check CHECK (
        status IN ('success', 'cache_hit', 'error', 'denied')
    );

-- The route used to persist the upstream CNMC message verbatim in `error_message`, which
-- puts unbounded third-party free text into the audit trail. Safe codes replace it; the
-- column stays for historical rows and is no longer written to.
ALTER TABLE public.sips_query_audit
    ADD COLUMN IF NOT EXISTS reason_code text;

ALTER TABLE public.sips_query_audit
    DROP CONSTRAINT IF EXISTS sips_query_audit_reason_code_check;

ALTER TABLE public.sips_query_audit
    ADD CONSTRAINT sips_query_audit_reason_code_check CHECK (
        reason_code IS NULL OR reason_code IN (
            'authorized',
            'unauthenticated',
            'account_not_active',
            'invalid_reference',
            'no_active_consent',
            'access_disabled',
            'authorization_unavailable',
            'upstream_unavailable',
            'upstream_failed'
        )
    );

COMMENT ON COLUMN public.sips_query_audit.reason_code IS
    'ZIN-SDD-043: safe reason taxonomy. Never contains raw CUPS, client identity or upstream free text.';
COMMENT ON COLUMN public.sips_query_audit.error_message IS
    'Deprecated by ZIN-SDD-043: retained for historical rows. New writes use reason_code.';

COMMIT;

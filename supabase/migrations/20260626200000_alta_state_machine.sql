-- Alta / cambio state machine for proposals
-- Tracks the ATR switch process from consent to activation.
-- Kept separate from proposal.status (draft/sent/accepted) — alta is a sub-process
-- that only starts once a proposal is accepted.

-- ── alta_status enum ─────────────────────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alta_status_enum') THEN
        CREATE TYPE public.alta_status_enum AS ENUM (
            'pendiente_consent',   -- proposal accepted; waiting for consent artefact
            'lista_admin',         -- consent confirmed; ready for admin to request switch
            'en_alta',             -- admin requested switch to distributor (SLA clock running)
            'activada',            -- distributor confirmed, client switched
            'rechazada'            -- rejected by distributor or cancelled
        );
    END IF;
END $$;

-- ── columns ───────────────────────────────────────────────────────────────────
ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS alta_status        public.alta_status_enum,
    -- Consent gate — hard block: sin esto no se puede solicitar el alta
    ADD COLUMN IF NOT EXISTS consent_confirmed_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS consent_confirmed_by   UUID REFERENCES auth.users(id),
    -- SEPA mandate — tracked separately from main consent
    ADD COLUMN IF NOT EXISTS sepa_confirmed_at      TIMESTAMPTZ,
    -- SLA clock: starts when admin submits to distributor (legal: 10 business days)
    ADD COLUMN IF NOT EXISTS alta_requested_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS alta_completada_at     TIMESTAMPTZ,
    -- Rejection
    ADD COLUMN IF NOT EXISTS alta_rejected_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS alta_rejection_reason  TEXT
        CHECK (alta_rejection_reason IN (
            'cups_invalido',
            'titular_no_coincide',
            'deuda_pendiente',
            'baja_no_resuelta',
            'switch_pendiente',
            'otro'
        )),
    ADD COLUMN IF NOT EXISTS alta_rejection_note    TEXT,
    -- Who requested/completed — audit trail
    ADD COLUMN IF NOT EXISTS alta_requested_by      UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS alta_completada_by     UUID REFERENCES auth.users(id);

-- ── index for dashboard queries ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_proposals_alta_status
    ON public.proposals (alta_status)
    WHERE alta_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_alta_requested_at
    ON public.proposals (alta_requested_at)
    WHERE alta_requested_at IS NOT NULL;

-- ── auto-set alta_status when a proposal is accepted ─────────────────────────
-- When proposal.status transitions to 'accepted', set alta_status to initial state.
CREATE OR REPLACE FUNCTION public.init_alta_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'accepted'
        AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted')
        AND NEW.alta_status IS NULL
    THEN
        NEW.alta_status := 'pendiente_consent';
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger function: not meant to be invoked via RPC.
-- Functions default to EXECUTE for PUBLIC, so revoke from PUBLIC (not just anon/auth).
REVOKE EXECUTE ON FUNCTION public.init_alta_on_accept() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_init_alta_on_accept ON public.proposals;
CREATE TRIGGER trg_init_alta_on_accept
    BEFORE INSERT OR UPDATE ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.init_alta_on_accept();

-- ── RLS: admin-only columns ───────────────────────────────────────────────────
-- (proposals RLS already exists; alta columns are readable by the row's agent
--  but only writable by admin — enforced in server actions via requireServerRole)

-- ── view for admin alta dashboard ────────────────────────────────────────────
CREATE OR REPLACE VIEW public.proposals_alta AS
SELECT
    p.id,
    p.client_id,
    p.agent_id,
    p.franchise_id,
    p.status,
    p.alta_status,
    p.consent_confirmed_at,
    p.sepa_confirmed_at,
    p.alta_requested_at,
    p.alta_completada_at,
    p.alta_rejected_at,
    p.alta_rejection_reason,
    p.alta_rejection_note,
    p.alta_requested_by,
    p.calculation_data,
    p.offer_snapshot,
    p.current_annual_cost,
    p.offer_annual_cost,
    p.annual_savings,
    p.created_at,
    p.updated_at,
    prof.full_name  AS agent_name,
    prof.email      AS agent_email,
    cli.name        AS client_name,
    cli.email       AS client_email
    -- NIF/IBAN are encrypted in clients; surfaced via calculation_data in the server action
FROM public.proposals p
LEFT JOIN public.profiles prof ON prof.id = p.agent_id
LEFT JOIN public.clients  cli  ON cli.id  = p.client_id
WHERE p.status = 'accepted';

-- The view must respect the RLS of the underlying tables (admin sees all,
-- agent sees only their own); without this it would run as owner and leak data.
ALTER VIEW public.proposals_alta SET (security_invoker = on);
REVOKE ALL ON public.proposals_alta FROM anon;

COMMENT ON VIEW public.proposals_alta IS
    'Admin-facing view of accepted proposals with full alta workflow context. security_invoker=on.';

-- ── Append-only audit trail of alta state transitions ────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_alta_events (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    actor_id    uuid REFERENCES auth.users(id),
    event_type  text NOT NULL CHECK (event_type IN (
        'consent_confirmed', 'alta_requested', 'alta_completed',
        'alta_rejected', 'alta_reopened'
    )),
    detail      text,
    metadata    jsonb DEFAULT '{}'::jsonb,
    created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proposal_alta_events_proposal
    ON public.proposal_alta_events (proposal_id, created_at DESC);

ALTER TABLE public.proposal_alta_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_alta_events_admin_read ON public.proposal_alta_events;
CREATE POLICY rls_alta_events_admin_read
    ON public.proposal_alta_events FOR SELECT
    USING (is_superadmin());

-- TRUNCATE/REFERENCES bypass RLS — strip everything and re-grant only RLS-gated SELECT.
REVOKE ALL ON public.proposal_alta_events FROM anon, authenticated;
GRANT SELECT ON public.proposal_alta_events TO authenticated;

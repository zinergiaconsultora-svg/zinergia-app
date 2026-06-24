-- =============================================
-- LEAD AUDIT EVENTS — historial append-only por factura/lead
-- =============================================
-- Registra acciones operativas del flujo OCR → lead → cliente/perdido:
-- cierres, reaperturas, cambios de motivo y notas internas. La tabla es
-- append-only para usuarios autenticados: no se conceden UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS public.lead_audit_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID NOT NULL REFERENCES public.ocr_jobs(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL CHECK (
        event_type IN (
            'note_added',
            'lead_closed_won',
            'lead_marked_lost',
            'lead_reopened',
            'closure_updated',
            'lost_reason_updated',
            'drive_synced',
            'ocr_failed',
            'lead_reassigned'
        )
    ),
    title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
    detail      TEXT CHECK (detail IS NULL OR char_length(detail) <= 2000),
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_audit_events_job_created
    ON public.lead_audit_events(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_audit_events_actor_created
    ON public.lead_audit_events(actor_id, created_at DESC)
    WHERE actor_id IS NOT NULL;

ALTER TABLE public.lead_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_lead_audit_events_select_visible_job
    ON public.lead_audit_events;
CREATE POLICY rls_lead_audit_events_select_visible_job
    ON public.lead_audit_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.ocr_jobs j
            WHERE j.id = lead_audit_events.job_id
              AND (
                  public.is_superadmin()
                  OR j.agent_id = auth.uid()
                  OR j.franchise_id = public.get_my_franchise_id()
              )
        )
    );

-- Sin policy de INSERT: los usuarios NO insertan directamente. Todos los eventos
-- se escriben desde el servidor con el service client (acciones + webhook OCR +
-- archivado Drive), de modo que el log es a prueba de manipulación.
DROP POLICY IF EXISTS rls_lead_audit_events_insert_visible_job
    ON public.lead_audit_events;

-- Append-only y solo-lectura para usuarios: Supabase concede ALL a authenticated
-- por defecto → revocamos todo y concedemos únicamente SELECT (lectura RLS-scoped).
-- INSERT/UPDATE/DELETE quedan reservados al service role (bypass RLS).
REVOKE ALL ON TABLE public.lead_audit_events FROM authenticated, anon;
GRANT SELECT ON TABLE public.lead_audit_events TO authenticated;

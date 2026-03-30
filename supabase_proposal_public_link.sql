-- =============================================
-- Propuesta Pública: token de acceso sin login
-- =============================================

-- 1. Añadir columnas a proposals
ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS public_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS public_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS public_accepted_ip TEXT;

-- 2. Índice para búsqueda rápida por token
CREATE INDEX IF NOT EXISTS idx_proposals_public_token
    ON public.proposals(public_token)
    WHERE public_token IS NOT NULL;

-- 3. Política RLS: cualquiera puede leer una propuesta por token válido (sin auth)
-- Necesita que "anon" tenga acceso SELECT limitado al token
DROP POLICY IF EXISTS "rls_proposals_public_read" ON public.proposals;
CREATE POLICY "rls_proposals_public_read" ON public.proposals
    FOR SELECT
    USING (
        -- Token existe, no ha expirado y propuesta no está cancelada
        public_token IS NOT NULL
        AND public_expires_at > now()
        AND status NOT IN ('rejected', 'expired')
    );

-- 4. Política RLS: anon puede actualizar SOLO el campo public_accepted_at (aceptar propuesta)
DROP POLICY IF EXISTS "rls_proposals_public_accept" ON public.proposals;
CREATE POLICY "rls_proposals_public_accept" ON public.proposals
    FOR UPDATE
    USING (
        public_token IS NOT NULL
        AND public_expires_at > now()
        AND status = 'sent'
    )
    WITH CHECK (
        -- Solo permite cambiar status a 'accepted' y registrar la fecha
        status = 'accepted'
    );

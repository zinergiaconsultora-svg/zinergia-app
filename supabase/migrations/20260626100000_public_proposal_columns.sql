-- Columnas para el enlace público de propuestas (compartir/firmar)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS public_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_data TEXT,
  ADD COLUMN IF NOT EXISTS signed_name TEXT;

CREATE INDEX IF NOT EXISTS idx_proposals_public_token ON proposals (public_token) WHERE public_token IS NOT NULL;

-- Lectura anónima de propuestas con token público válido
CREATE POLICY "public_proposal_read"
  ON proposals FOR SELECT
  TO anon
  USING (
    public_token IS NOT NULL
    AND status IN ('sent', 'accepted')
    AND (public_expires_at IS NULL OR public_expires_at > now())
  );

-- El anon puede aceptar (firmar) propuestas enviadas
CREATE POLICY "public_proposal_accept"
  ON proposals FOR UPDATE
  TO anon
  USING (
    public_token IS NOT NULL
    AND status = 'sent'
    AND (public_expires_at IS NULL OR public_expires_at > now())
  )
  WITH CHECK (
    status = 'accepted'
  );

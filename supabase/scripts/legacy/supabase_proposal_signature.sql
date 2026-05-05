-- =============================================
-- Firma Digital en Propuestas
-- =============================================

-- Añadir columna para la firma (base64 PNG del canvas)
ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS signature_data TEXT,       -- base64 PNG de la firma
    ADD COLUMN IF NOT EXISTS signed_name TEXT,          -- nombre que introdujo el firmante
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;     -- timestamp exacto de la firma

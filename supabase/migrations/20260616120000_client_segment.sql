-- =============================================================================
-- Migration: client segment (RESIDENCIAL / PYME)
-- Date:      2026-06-16
--
-- El segmento de negocio del cliente NO es deducible del DNI/CIF ni de la
-- tarifa eléctrica (un PYME puede estar en 2.0TD). Pasa a capturarse de forma
-- explícita en el simulador (paso previo a la subida de la factura) y se
-- propaga: ocr_jobs.client_segment -> clients.segment -> comparación.
--
-- Valores: 'RESIDENCIAL' | 'PYME' (coinciden con lv_zinergia_tarifas.tipo_cliente,
-- para poder filtrar el catálogo por segmento). Nullable: filas existentes
-- quedan sin segmento hasta que se editen.
-- Aditiva y reversible (sólo añade columnas).
-- =============================================================================

ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS segment text
    CONSTRAINT clients_segment_check CHECK (segment IS NULL OR segment IN ('RESIDENCIAL', 'PYME'));

ALTER TABLE public.ocr_jobs
    ADD COLUMN IF NOT EXISTS client_segment text
    CONSTRAINT ocr_jobs_client_segment_check CHECK (client_segment IS NULL OR client_segment IN ('RESIDENCIAL', 'PYME'));

COMMENT ON COLUMN public.clients.segment IS
    'Segmento de negocio elegido por el usuario (RESIDENCIAL/PYME). Independiente de tariff_type y del tipo de documento.';
COMMENT ON COLUMN public.ocr_jobs.client_segment IS
    'Segmento elegido en el simulador antes de subir la factura; el webhook lo copia a clients.segment.';

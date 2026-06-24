-- =============================================
-- INVOICE REGISTRY — VIEW del registro de facturas
-- =============================================
-- Una fila por factura subida (ocr_jobs), con su estado de proceso derivado,
-- el enlace a Drive, los datos OCR y (si el lead está cerrado) la compañía/
-- tarifa/permanencia del contrato.
--
-- security_invoker = true → la VIEW respeta la RLS de las tablas base, de modo
-- que cada comercial ve solo sus facturas y el admin las ve todas, sin políticas
-- nuevas. (Postgres 15+; staging/prod = PG17.)
--
-- La COMISIÓN se omite a propósito en v1: network_commissions se liga a
-- proposal_id/agent_id, no a la factura ni al cliente, por lo que su asociación
-- por factura es ambigua. Se aborda en la Fase 5 (cierre del lead).

CREATE OR REPLACE VIEW public.invoice_registry
WITH (security_invoker = true) AS
SELECT
    j.id                                   AS job_id,
    j.agent_id,
    j.franchise_id,
    j.client_id,
    j.created_at,
    j.status                               AS ocr_status,
    j.compared_at,
    j.drive_view_link,
    j.drive_synced_at,
    (j.drive_synced_at IS NOT NULL)        AS archived_in_drive,

    -- Estado del proceso (una sola fuente por hecho):
    CASE
        WHEN c.status = 'won'             THEN 'closed_won'
        WHEN c.status = 'lost'            THEN 'closed_lost'
        WHEN j.compared_at IS NOT NULL    THEN 'compared'
        WHEN j.status = 'completed'       THEN 'ocr_done'
        WHEN j.status = 'failed'          THEN 'failed'
        ELSE 'uploaded'
    END                                    AS process_status,

    -- Datos de la factura (extracted_data es JSONB plano en este flujo).
    j.extracted_data->>'client_name'       AS titular,
    j.extracted_data->>'company_name'      AS comercializadora_actual,
    j.extracted_data->>'cups'              AS cups,
    j.extracted_data->>'total_amount'      AS importe_total,
    j.extracted_data->>'tariff_name'       AS tarifa_actual,

    -- Cierre (si el lead ya es cliente con contrato).
    c.name                                 AS cliente_nombre,
    c.status                               AS cliente_status,
    ct.marketer_name                       AS compania_contratada,
    ct.tariff_name                         AS tarifa_contratada,
    ct.end_date                            AS permanencia_hasta
FROM public.ocr_jobs j
LEFT JOIN public.clients c ON c.id = j.client_id
LEFT JOIN LATERAL (
    SELECT marketer_name, tariff_name, end_date
    FROM public.contracts
    WHERE client_id = j.client_id
    ORDER BY created_at DESC
    LIMIT 1
) ct ON TRUE;

-- La RLS efectiva la imponen las tablas base (security_invoker); el rol
-- authenticated necesita el privilegio de lectura sobre la VIEW.
GRANT SELECT ON public.invoice_registry TO authenticated;

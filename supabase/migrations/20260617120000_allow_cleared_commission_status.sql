-- =============================================
-- network_commissions: permitir el estado 'cleared'
-- =============================================
--
-- El código de la app (clearCommissionAction, wallet, facturación, retiros) y la
-- vista `franchise_wallet` usan el estado 'cleared' para marcar una comisión
-- aprobada/disponible. El CHECK original solo permitía
-- ('pending','approved','paid','rejected'), por lo que aprobar una comisión
-- ('cleared') violaba la restricción. Ampliamos el CHECK (additivo, sin reescribir
-- datos) para incluir 'cleared' y mantener 'approved' por compatibilidad.

ALTER TABLE public.network_commissions
    DROP CONSTRAINT IF EXISTS network_commissions_status_check;

ALTER TABLE public.network_commissions
    ADD CONSTRAINT network_commissions_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'cleared'::text, 'paid'::text, 'rejected'::text]));

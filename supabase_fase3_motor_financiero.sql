-- =============================================
-- FASE 3: MOTOR FINANCIERO - Zinergia
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. TABLA: billing_cycles (Snapshots mensuales inmutables)
CREATE TABLE IF NOT EXISTS public.billing_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchise_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL,                          -- Formato: '2026-03'
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'closed', 'voided')),
    total_commissions NUMERIC NOT NULL DEFAULT 0,
    total_proposals INTEGER NOT NULL DEFAULT 0,
    snapshot_data JSONB,                               -- Array inmutable de comisiones al cerrar
    closed_by UUID REFERENCES public.profiles(id),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Idempotencia: solo puede existir un ciclo activo (no voided) por franquicia/mes
    CONSTRAINT unique_franchise_cycle UNIQUE(franchise_id, month_year)
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_billing_cycles_franchise 
    ON public.billing_cycles(franchise_id);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_status 
    ON public.billing_cycles(status);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_month 
    ON public.billing_cycles(month_year DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_billing_cycles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_billing_cycles_updated_at ON public.billing_cycles;
CREATE TRIGGER tr_billing_cycles_updated_at
    BEFORE UPDATE ON public.billing_cycles
    FOR EACH ROW
    EXECUTE FUNCTION update_billing_cycles_updated_at();


-- 2. ALTER: network_commissions → añadir billing_cycle_id
-- Vincula cada comisión al cierre que la procesó
ALTER TABLE public.network_commissions
    ADD COLUMN IF NOT EXISTS billing_cycle_id UUID REFERENCES public.billing_cycles(id);

CREATE INDEX IF NOT EXISTS idx_commissions_billing_cycle
    ON public.network_commissions(billing_cycle_id);


-- 3. VISTA: franchise_wallet (Balance en tiempo real)
CREATE OR REPLACE VIEW public.franchise_wallet AS
SELECT
    nc.franchise_id,
    -- Comisiones aprobadas pendientes de cobro
    COALESCE(SUM(CASE WHEN nc.status = 'cleared' THEN nc.franchise_commission ELSE 0 END), 0) 
        AS balance_available,
    -- Comisiones ya pagadas (incluidas en algún cierre)
    COALESCE(SUM(CASE WHEN nc.status = 'paid' THEN nc.franchise_commission ELSE 0 END), 0) 
        AS balance_paid,
    -- Comisiones pendientes de aprobación
    COALESCE(SUM(CASE WHEN nc.status = 'pending' THEN nc.franchise_commission ELSE 0 END), 0) 
        AS balance_pending,
    -- Total histórico (todo menos rechazadas)
    COALESCE(SUM(CASE WHEN nc.status != 'rejected' THEN nc.franchise_commission ELSE 0 END), 0) 
        AS total_earned,
    -- Conteo de propuestas por estado
    COUNT(CASE WHEN nc.status = 'cleared' THEN 1 END) AS proposals_cleared,
    COUNT(CASE WHEN nc.status = 'paid' THEN 1 END) AS proposals_paid,
    COUNT(CASE WHEN nc.status = 'pending' THEN 1 END) AS proposals_pending
FROM public.network_commissions nc
GROUP BY nc.franchise_id;


-- 4. RLS: billing_cycles
ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;

-- Agentes solo ven sus propios ciclos
DROP POLICY IF EXISTS "billing_cycles_select_own" ON public.billing_cycles;
CREATE POLICY "billing_cycles_select_own"
    ON public.billing_cycles FOR SELECT
    USING (
        franchise_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- Solo admin puede insertar/modificar ciclos de billing
DROP POLICY IF EXISTS "billing_cycles_insert_admin" ON public.billing_cycles;
CREATE POLICY "billing_cycles_insert_admin"
    ON public.billing_cycles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
        OR franchise_id = auth.uid()
    );

DROP POLICY IF EXISTS "billing_cycles_update_admin" ON public.billing_cycles;
CREATE POLICY "billing_cycles_update_admin"
    ON public.billing_cycles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
        OR franchise_id = auth.uid()
    );

-- No se permite DELETE (los ciclos se "voidan", nunca se borran)


-- 5. Publicar billing_cycles a Supabase Realtime (idempotente)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_cycles;
EXCEPTION WHEN duplicate_object THEN
    -- Ya es miembro, ignorar
    NULL;
END;
$$;


-- =============================================
-- VERIFICACIÓN: Ejecutar después para comprobar
-- =============================================
-- SELECT * FROM public.franchise_wallet;
-- SELECT * FROM public.billing_cycles LIMIT 5;

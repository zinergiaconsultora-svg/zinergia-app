-- SIPS annual consumption cache + Plenitude commission bands.
-- Keeps CUPS out of storage; only the application blind index is persisted.

CREATE TABLE IF NOT EXISTS public.sips_consumption_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    cups_hash text NOT NULL UNIQUE,
    annual_consumption_kwh numeric DEFAULT 0 NOT NULL,
    annual_consumption_mwh numeric DEFAULT 0 NOT NULL,
    rows_count integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'CNMC_SIPS' NOT NULL,
    fetched_at timestamptz DEFAULT now() NOT NULL,
    expires_at timestamptz DEFAULT (now() + interval '30 days') NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sips_query_audit (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now() NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    cups_hash text NOT NULL,
    status text NOT NULL CHECK (status IN ('success', 'cache_hit', 'error')),
    error_message text
);

CREATE TABLE IF NOT EXISTS public.sips_consents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now() NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    cups_hash text NOT NULL,
    consent_source text NOT NULL DEFAULT 'agent_confirmation',
    consent_at timestamptz DEFAULT now() NOT NULL,
    revoked_at timestamptz,
    notes text
);

CREATE INDEX IF NOT EXISTS idx_sips_consumption_cache_cups_hash ON public.sips_consumption_cache (cups_hash);
CREATE INDEX IF NOT EXISTS idx_sips_consumption_cache_expires_at ON public.sips_consumption_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_sips_query_audit_user_created ON public.sips_query_audit (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sips_consents_cups_hash ON public.sips_consents (cups_hash);

ALTER TABLE public.sips_consumption_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sips_query_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sips_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read SIPS cache" ON public.sips_consumption_cache;
DROP POLICY IF EXISTS "Authenticated users can manage SIPS cache" ON public.sips_consumption_cache;
CREATE POLICY "Authenticated users can read SIPS cache"
    ON public.sips_consumption_cache FOR SELECT
    TO authenticated
    USING (true);
CREATE POLICY "Authenticated users can manage SIPS cache"
    ON public.sips_consumption_cache FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own SIPS audit" ON public.sips_query_audit;
DROP POLICY IF EXISTS "Users can insert own SIPS audit" ON public.sips_query_audit;
CREATE POLICY "Users can read own SIPS audit"
    ON public.sips_query_audit FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
CREATE POLICY "Users can insert own SIPS audit"
    ON public.sips_query_audit FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own SIPS consents" ON public.sips_consents;
CREATE POLICY "Users can manage own SIPS consents"
    ON public.sips_consents FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_sips_consumption_cache_updated_at ON public.sips_consumption_cache;
CREATE TRIGGER update_sips_consumption_cache_updated_at
    BEFORE UPDATE ON public.sips_consumption_cache
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DELETE FROM public.tariff_commissions
WHERE company = 'Plenitude'
  AND supply_type = 'electricity'
  AND modelo IN ('3.0TD', '6.1TD');

INSERT INTO public.tariff_commissions (
    company,
    modelo,
    supply_type,
    tipo_cliente,
    producto_tipo,
    consumption_min_mwh,
    consumption_max_mwh,
    commission_fixed_eur,
    commission_variable_mwh,
    servicio,
    notes,
    is_active
)
SELECT
    'Plenitude',
    tariff_type,
    'electricity',
    'PYME',
    commission_group,
    min_mwh,
    COALESCE(max_mwh, 9999999999),
    commission_eur,
    0,
    'LUZ',
    'Comisiones Plenitude MR8 11/02/2026. Tramo calculado por consumo anual MWh.',
    true
FROM (
    VALUES
    ('3.0TD','POWER_PLUS_ENERGY_PLUS',0,1,151.20),('3.0TD','POWER_PLUS_ENERGY_PLUS',1,2,156.80),('3.0TD','POWER_PLUS_ENERGY_PLUS',2,5,162.40),('3.0TD','POWER_PLUS_ENERGY_PLUS',5,10,252.80),('3.0TD','POWER_PLUS_ENERGY_PLUS',10,20,406.40),('3.0TD','POWER_PLUS_ENERGY_PLUS',20,30,625.60),('3.0TD','POWER_PLUS_ENERGY_PLUS',30,40,684.80),('3.0TD','POWER_PLUS_ENERGY_PLUS',40,50,764.80),('3.0TD','POWER_PLUS_ENERGY_PLUS',50,70,950.40),('3.0TD','POWER_PLUS_ENERGY_PLUS',70,100,1339.20),('3.0TD','POWER_PLUS_ENERGY_PLUS',100,150,2080.80),('3.0TD','POWER_PLUS_ENERGY_PLUS',150,200,2967.20),('3.0TD','POWER_PLUS_ENERGY_PLUS',200,300,4149.60),('3.0TD','POWER_PLUS_ENERGY_PLUS',300,400,5912.00),('3.0TD','POWER_PLUS_ENERGY_PLUS',400,500,7071.20),('3.0TD','POWER_PLUS_ENERGY_PLUS',500,700,9389.60),('3.0TD','POWER_PLUS_ENERGY_PLUS',700,1200,14026.40),('3.0TD','POWER_PLUS_ENERGY_PLUS',1200,NULL,21445.60),
    ('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',0,1,156.80),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',1,2,156.80),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',2,5,156.80),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',5,10,156.80),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',10,20,198.40),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',20,30,272.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',30,40,318.40),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',40,50,364.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',50,70,456.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',70,100,732.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',100,150,824.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',150,200,1100.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',200,300,1468.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',300,400,2020.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',400,500,2572.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',500,700,2940.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',700,1200,3492.00),('3.0TD','FACIL_POWER_PLUS_FACIL_ENERGY_PLUS',1200,NULL,3676.00),
    ('3.0TD','POWER_ENERGY',0,1,66.40),('3.0TD','POWER_ENERGY',1,2,80.00),('3.0TD','POWER_ENERGY',2,5,96.00),('3.0TD','POWER_ENERGY',5,10,126.40),('3.0TD','POWER_ENERGY',10,20,188.80),('3.0TD','POWER_ENERGY',20,30,289.60),('3.0TD','POWER_ENERGY',30,40,377.60),('3.0TD','POWER_ENERGY',40,50,473.60),('3.0TD','POWER_ENERGY',50,70,575.20),('3.0TD','POWER_ENERGY',70,100,787.20),('3.0TD','POWER_ENERGY',100,150,922.40),('3.0TD','POWER_ENERGY',150,200,1313.60),('3.0TD','POWER_ENERGY',200,300,1835.20),('3.0TD','POWER_ENERGY',300,400,2627.20),('3.0TD','POWER_ENERGY',400,500,3448.80),('3.0TD','POWER_ENERGY',500,700,4540.00),('3.0TD','POWER_ENERGY',700,1200,6376.00),('3.0TD','POWER_ENERGY',1200,NULL,11108.80),
    ('3.0TD','FACIL_POWER_FACIL_ENERGY',0,1,110.40),('3.0TD','FACIL_POWER_FACIL_ENERGY',1,2,110.40),('3.0TD','FACIL_POWER_FACIL_ENERGY',2,5,110.40),('3.0TD','FACIL_POWER_FACIL_ENERGY',5,10,110.40),('3.0TD','FACIL_POWER_FACIL_ENERGY',10,20,134.40),('3.0TD','FACIL_POWER_FACIL_ENERGY',20,30,161.60),('3.0TD','FACIL_POWER_FACIL_ENERGY',30,40,198.40),('3.0TD','FACIL_POWER_FACIL_ENERGY',40,50,272.00),('3.0TD','FACIL_POWER_FACIL_ENERGY',50,70,364.00),('3.0TD','FACIL_POWER_FACIL_ENERGY',70,100,456.00),('3.0TD','FACIL_POWER_FACIL_ENERGY',100,150,548.00),('3.0TD','FACIL_POWER_FACIL_ENERGY',150,200,686.40),('3.0TD','FACIL_POWER_FACIL_ENERGY',200,300,778.40),('3.0TD','FACIL_POWER_FACIL_ENERGY',300,400,916.00),('3.0TD','FACIL_POWER_FACIL_ENERGY',400,500,1376.00),('3.0TD','FACIL_POWER_FACIL_ENERGY',500,700,2020.00),('3.0TD','FACIL_POWER_FACIL_ENERGY',700,1200,2296.00),('3.0TD','FACIL_POWER_FACIL_ENERGY',1200,NULL,2756.00),
    ('3.0TD','FACIL_PRIME',0,1,138.40),('3.0TD','FACIL_PRIME',1,2,138.40),('3.0TD','FACIL_PRIME',2,5,138.40),('3.0TD','FACIL_PRIME',5,10,138.40),('3.0TD','FACIL_PRIME',10,20,152.80),('3.0TD','FACIL_PRIME',20,30,198.40),('3.0TD','FACIL_PRIME',30,40,272.00),('3.0TD','FACIL_PRIME',40,50,318.40),('3.0TD','FACIL_PRIME',50,70,410.40),('3.0TD','FACIL_PRIME',70,100,640.00),('3.0TD','FACIL_PRIME',100,150,732.00),('3.0TD','FACIL_PRIME',150,200,916.00),('3.0TD','FACIL_PRIME',200,300,1284.00),('3.0TD','FACIL_PRIME',300,400,1836.00),('3.0TD','FACIL_PRIME',400,500,2296.00),('3.0TD','FACIL_PRIME',500,700,2756.00),('3.0TD','FACIL_PRIME',700,1200,2940.00),('3.0TD','FACIL_PRIME',1200,NULL,3216.00),
    ('6.1TD','POWER_PLUS_ENERGY_PLUS',0,1,131.20),('6.1TD','POWER_PLUS_ENERGY_PLUS',1,2,136.00),('6.1TD','POWER_PLUS_ENERGY_PLUS',2,5,140.80),('6.1TD','POWER_PLUS_ENERGY_PLUS',5,10,220.00),('6.1TD','POWER_PLUS_ENERGY_PLUS',10,20,353.60),('6.1TD','POWER_PLUS_ENERGY_PLUS',20,30,544.00),('6.1TD','POWER_PLUS_ENERGY_PLUS',30,40,595.20),('6.1TD','POWER_PLUS_ENERGY_PLUS',40,50,665.60),('6.1TD','POWER_PLUS_ENERGY_PLUS',50,70,826.40),('6.1TD','POWER_PLUS_ENERGY_PLUS',70,100,1164.80),('6.1TD','POWER_PLUS_ENERGY_PLUS',100,150,1809.60),('6.1TD','POWER_PLUS_ENERGY_PLUS',150,200,2580.80),('6.1TD','POWER_PLUS_ENERGY_PLUS',200,300,3608.80),('6.1TD','POWER_PLUS_ENERGY_PLUS',300,400,5140.80),('6.1TD','POWER_PLUS_ENERGY_PLUS',400,500,6148.80),('6.1TD','POWER_PLUS_ENERGY_PLUS',500,700,8164.80),('6.1TD','POWER_PLUS_ENERGY_PLUS',700,1200,12196.80),('6.1TD','POWER_PLUS_ENERGY_PLUS',1200,NULL,18648.00),
    ('6.1TD','POWER_ENERGY',0,1,57.96),('6.1TD','POWER_ENERGY',1,2,69.72),('6.1TD','POWER_ENERGY',2,5,83.16),('6.1TD','POWER_ENERGY',5,10,109.20),('6.1TD','POWER_ENERGY',10,20,163.80),('6.1TD','POWER_ENERGY',20,30,252.00),('6.1TD','POWER_ENERGY',30,40,327.60),('6.1TD','POWER_ENERGY',40,50,411.60),('6.1TD','POWER_ENERGY',50,70,499.80),('6.1TD','POWER_ENERGY',70,100,684.60),('6.1TD','POWER_ENERGY',100,150,802.20),('6.1TD','POWER_ENERGY',150,200,1142.40),('6.1TD','POWER_ENERGY',200,300,1596.00),('6.1TD','POWER_ENERGY',300,400,2284.80),('6.1TD','POWER_ENERGY',400,500,2998.80),('6.1TD','POWER_ENERGY',500,700,3948.00),('6.1TD','POWER_ENERGY',700,1200,5544.00),('6.1TD','POWER_ENERGY',1200,NULL,9660.00)
) AS data(tariff_type, commission_group, min_mwh, max_mwh, commission_eur);

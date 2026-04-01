-- =============================================================
-- MIGRATION: 20260401_tariff_model_v2.sql
-- Extiende lv_zinergia_tarifas: soporte gas, modelo/canal,
-- tipo_cliente, código de producto.
-- Crea tariff_commissions y tax_parameters.
-- Importa datos reales del Excel BASE_DATOS_TARIFAS_v1.
-- =============================================================


-- ─── 1. EXTENDER lv_zinergia_tarifas ─────────────────────────────────────────

ALTER TABLE lv_zinergia_tarifas
  ADD COLUMN IF NOT EXISTS supply_type         TEXT NOT NULL DEFAULT 'electricity',
  ADD COLUMN IF NOT EXISTS modelo              TEXT,
  ADD COLUMN IF NOT EXISTS tipo_cliente        TEXT NOT NULL DEFAULT 'PYME',
  ADD COLUMN IF NOT EXISTS codigo_producto     TEXT,
  ADD COLUMN IF NOT EXISTS consumption_min_kwh NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consumption_max_kwh NUMERIC NOT NULL DEFAULT 9999999999,
  -- Gas: término fijo anual (€/año) y término variable (€/kWh)
  ADD COLUMN IF NOT EXISTS fixed_annual_fee_gas    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variable_price_kwh_gas  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes               TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_supply_type'
      AND conrelid = 'lv_zinergia_tarifas'::regclass
  ) THEN
    ALTER TABLE lv_zinergia_tarifas
      ADD CONSTRAINT chk_supply_type CHECK (supply_type IN ('electricity', 'gas'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tipo_cliente'
      AND conrelid = 'lv_zinergia_tarifas'::regclass
  ) THEN
    ALTER TABLE lv_zinergia_tarifas
      ADD CONSTRAINT chk_tipo_cliente CHECK (tipo_cliente IN ('PYME', 'RESIDENCIAL', 'GRAN_CUENTA'));
  END IF;
END $$;


-- ─── 2. REEMPLAZAR UNIQUE CONSTRAINT ─────────────────────────────────────────
-- Incluye tariff_type y modelo para permitir misma compañía+nombre con
-- diferentes tarifas ATR o canales de venta (BASE/ONE/SUPRA).

ALTER TABLE lv_zinergia_tarifas DROP CONSTRAINT IF EXISTS unique_tariff;

CREATE UNIQUE INDEX IF NOT EXISTS unique_tariff_v2
  ON lv_zinergia_tarifas (company, tariff_name, tariff_type, COALESCE(modelo, ''));


-- ─── 3. TABLA: tariff_commissions ────────────────────────────────────────────
-- Comisión bruta que la comercializadora paga a Zinergia por contrato firmado.
-- La regla activa en commission_rules define cómo se reparte con el colaborador.

CREATE TABLE IF NOT EXISTS tariff_commissions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  company          TEXT        NOT NULL,
  modelo           TEXT,                          -- BASE / ONE / SUPRA / NULL=todos
  supply_type      TEXT        NOT NULL DEFAULT 'electricity'
    CHECK (supply_type IN ('electricity', 'gas')),
  tipo_cliente     TEXT        NOT NULL DEFAULT 'PYME'
    CHECK (tipo_cliente IN ('PYME', 'RESIDENCIAL', 'GRAN_CUENTA')),
  producto_tipo    TEXT,                          -- ELECTRICIDAD_FIJO, GAS, etc.

  -- Rango de consumo anual en MWh al que aplica esta regla
  consumption_min_mwh  NUMERIC NOT NULL DEFAULT 0,
  consumption_max_mwh  NUMERIC NOT NULL DEFAULT 9999999999,

  -- Comisión bruta: solo uno de los dos será > 0
  commission_fixed_eur     NUMERIC NOT NULL DEFAULT 0,  -- € fijo por contrato
  commission_variable_mwh  NUMERIC NOT NULL DEFAULT 0,  -- € por MWh consumido

  servicio  TEXT,    -- LUZ / GAS (para display)
  notes     TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_tc_company    ON tariff_commissions (company);
CREATE INDEX IF NOT EXISTS idx_tc_supply     ON tariff_commissions (supply_type);
CREATE INDEX IF NOT EXISTS idx_tc_active     ON tariff_commissions (is_active);

CREATE OR REPLACE TRIGGER update_tariff_commissions_updated_at
  BEFORE UPDATE ON tariff_commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tariff_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read active commissions" ON tariff_commissions;
CREATE POLICY "Authenticated can read active commissions"
  ON tariff_commissions FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage commissions" ON tariff_commissions;
CREATE POLICY "Admins can manage commissions"
  ON tariff_commissions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ─── 4. TABLA: tax_parameters ────────────────────────────────────────────────
-- Parámetros fiscales configurables sin tocar código.

CREATE TABLE IF NOT EXISTS tax_parameters (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  key         TEXT        NOT NULL UNIQUE,
  value       NUMERIC     NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE
);

ALTER TABLE tax_parameters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read tax params" ON tax_parameters;
CREATE POLICY "Authenticated can read tax params"
  ON tax_parameters FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage tax params" ON tax_parameters;
CREATE POLICY "Admins can manage tax params"
  ON tax_parameters FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

INSERT INTO tax_parameters (key, value, description) VALUES
  ('IEE',           0.051127, 'Impuesto Eléctrico Español (5.11%)'),
  ('IVA_PENINSULA', 0.210000, 'IVA Península (21%)'),
  ('IVA_CANARIAS',  0.000000, 'IVA Canarias (0% — se aplica IGIC)'),
  ('IGIC_CANARIAS', 0.030000, 'IGIC Canarias (3%)'),
  ('IVA_REDUCIDO',  0.100000, 'IVA Reducido (10%) — casos especiales')
ON CONFLICT (key) DO UPDATE SET
  value       = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at  = NOW();


-- ─── 5. TABLA: commission_rules (crear si no existe) + collaborator_pct ───────

CREATE TABLE IF NOT EXISTS public.commission_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.15,
  agent_share     NUMERIC(5,4) NOT NULL DEFAULT 0.30,
  franchise_share NUMERIC(5,4) NOT NULL DEFAULT 0.50,
  hq_share        NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  collaborator_pct NUMERIC(5,4) NOT NULL DEFAULT 0.50,
  points_per_win  INTEGER      NOT NULL DEFAULT 50,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  effective_from  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by      UUID         REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT shares_sum_to_one CHECK (round(agent_share + franchise_share + hq_share, 4) = 1.0),
  CONSTRAINT valid_commission_rate CHECK (commission_rate > 0 AND commission_rate <= 1),
  CONSTRAINT valid_agent_share     CHECK (agent_share > 0 AND agent_share < 1),
  CONSTRAINT valid_franchise_share CHECK (franchise_share > 0 AND franchise_share < 1),
  CONSTRAINT valid_hq_share        CHECK (hq_share > 0 AND hq_share < 1),
  CONSTRAINT valid_collaborator_pct CHECK (collaborator_pct >= 0 AND collaborator_pct <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS commission_rules_single_active
  ON public.commission_rules (is_active) WHERE is_active = TRUE;

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and franchise can manage commission rules" ON public.commission_rules;
CREATE POLICY "Admin and franchise can manage commission rules"
  ON public.commission_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'franchise')
    )
  );

INSERT INTO public.commission_rules
  (name, commission_rate, agent_share, franchise_share, hq_share, collaborator_pct, points_per_win, is_active)
VALUES
  ('Regla por defecto', 0.15, 0.30, 0.50, 0.20, 0.50, 50, TRUE)
ON CONFLICT DO NOTHING;

-- Añadir collaborator_pct si la tabla ya existía sin esa columna
ALTER TABLE public.commission_rules
  ADD COLUMN IF NOT EXISTS collaborator_pct NUMERIC(5,4) NOT NULL DEFAULT 0.50;


-- ─── 6. TARIFAS ELECTRICIDAD (Excel BASE_DATOS_TARIFAS_v1) ───────────────────

INSERT INTO lv_zinergia_tarifas (
  company, tipo_cliente, tariff_type, codigo_producto, tariff_name, modelo,
  supply_type,
  consumption_min_kwh, consumption_max_kwh,
  power_price_p1, power_price_p2, power_price_p3,
  power_price_p4, power_price_p5, power_price_p6,
  energy_price_p1, energy_price_p2, energy_price_p3,
  energy_price_p4, energy_price_p5, energy_price_p6,
  notes
) VALUES

-- ── NATURGY PYME 2.0TD ── E0008 Plan Fijo Luz 24h (unihorario) ──────────────
('NATURGY','PYME','2.0TD','E0008','Plan Fijo Luz 24h','BASE','electricity',
  0,9999999999,
  0.122973,0.043976,0, 0,0,0,
  0.136171,0,0, 0,0,0,
  'Precio único 24h'),

('NATURGY','PYME','2.0TD','E0008','Plan Fijo Luz 24h','ONE','electricity',
  0,9999999999,
  0.122973,0.043976,0, 0,0,0,
  0.120671,0,0, 0,0,0,
  'Precio único 24h'),

('NATURGY','PYME','2.0TD','E0008','Plan Fijo Luz 24h','SUPRA','electricity',
  0,9999999999,
  0.122973,0.043976,0, 0,0,0,
  0.149171,0,0, 0,0,0,
  'Precio único 24h'),

-- ── NATURGY PYME 2.0TD ── E0009 Plan Fijo Luz Trihorario ────────────────────
('NATURGY','PYME','2.0TD','E0009','Plan Fijo Luz 2.0 Trihorario','BASE','electricity',
  0,9999999999,
  0.122973,0.043976,0, 0,0,0,
  0.206464,0.133311,0.097973, 0,0,0,
  '3 periodos horarios'),

('NATURGY','PYME','2.0TD','E0009','Plan Fijo Luz 2.0 Trihorario','ONE','electricity',
  0,9999999999,
  0.122973,0.043976,0, 0,0,0,
  0.190964,0.117811,0.082473, 0,0,0,
  '3 periodos horarios'),

('NATURGY','PYME','2.0TD','E0009','Plan Fijo Luz 2.0 Trihorario','SUPRA','electricity',
  0,9999999999,
  0.122973,0.043976,0, 0,0,0,
  0.219465,0.146312,0.110973, 0,0,0,
  '3 periodos horarios'),

-- ── NATURGY PYME 3.0TD ── E0009 Plan Fijo Luz 3.0 ──────────────────────────
('NATURGY','PYME','3.0TD','E0009','Plan Fijo Luz 3.0','BASE','electricity',
  0,9999999999,
  0.057928,0.031190,0.014379, 0.012748,0.008988,0.006052,
  0.195993,0.170414,0.147424, 0.133736,0.127043,0.119208,
  '6 periodos — facturación 3 periodos energía'),

('NATURGY','PYME','3.0TD','E0009','Plan Fijo Luz 3.0','ONE','electricity',
  0,9999999999,
  0.057928,0.031190,0.014379, 0.012748,0.008988,0.006052,
  0.183593,0.158014,0.134925, 0.121236,0.114444,0.106808,
  '6 periodos — facturación 3 periodos energía'),

('NATURGY','PYME','3.0TD','E0009','Plan Fijo Luz 3.0','SUPRA','electricity',
  0,9999999999,
  0.057928,0.031190,0.014379, 0.012748,0.008988,0.006052,
  0.215493,0.189914,0.166925, 0.153235,0.146543,0.138708,
  '6 periodos — facturación 3 periodos energía'),

-- ── NATURGY PYME 6.1TD ── E0009 Plan Fijo Luz 6.1 ──────────────────────────
('NATURGY','PYME','6.1TD','E0009','Plan Fijo Luz 6.1','BASE','electricity',
  0,9999999999,
  0.081083,0.042506,0.018635, 0.014778,0.005822,0.002751,
  0.170106,0.149355,0.133961, 0.124135,0.117561,0.111182,
  '6 periodos completos'),

('NATURGY','PYME','6.1TD','E0009','Plan Fijo Luz 6.1','ONE','electricity',
  0,9999999999,
  0.081083,0.042506,0.018635, 0.014778,0.005822,0.002751,
  0.158307,0.137456,0.122062, 0.112235,0.105661,0.099383,
  '6 periodos completos'),

('NATURGY','PYME','6.1TD','E0009','Plan Fijo Luz 6.1','SUPRA','electricity',
  0,9999999999,
  0.081083,0.042506,0.018635, 0.014778,0.005822,0.002751,
  0.189606,0.168856,0.153461, 0.143635,0.137060,0.130683,
  '6 periodos completos'),

-- ── NATURGY RESIDENCIAL 2.0TD ────────────────────────────────────────────────
('NATURGY','RESIDENCIAL','2.0TD','E0001','Tarifa Por Uso Luz',NULL,'electricity',
  0,9999999999,
  0.123030,0.037337,0, 0,0,0,
  0.109900,0,0, 0,0,0,
  'Precio único'),

('NATURGY','RESIDENCIAL','2.0TD','E0004','Tarifa Noche Luz ECO',NULL,'electricity',
  0,9999999999,
  0.123030,0.037337,0, 0,0,0,
  0.180200,0.107200,0.071800, 0,0,0,
  '3 periodos horarios'),

-- ── GANA_ENERGIA RESIDENCIAL 2.0TD ──────────────────────────────────────────
('GANA_ENERGIA','RESIDENCIAL','2.0TD','GANA_24H','Tarifa 24h',NULL,'electricity',
  0,9999999999,
  0.089434,0.089434,0, 0,0,0,
  0.129000,0,0, 0,0,0,
  'Precio único 24h'),

('GANA_ENERGIA','RESIDENCIAL','2.0TD','GANA_MERCADO','Tarifa Precio de Mercado',NULL,'electricity',
  0,9999999999,
  0.075903,0.001988,0, 0,0,0,
  0,0,0, 0,0,0,
  'A precio coste — precio variable'),

('GANA_ENERGIA','RESIDENCIAL','2.0TD','GANA_TRAMOS','Tarifa Tramos Horarios',NULL,'electricity',
  0,9999999999,
  0.089434,0.089434,0, 0,0,0,
  0.181000,0.114000,0.090000, 0,0,0,
  '3 periodos horarios')

ON CONFLICT DO NOTHING;


-- ─── 7. TARIFAS GAS (Excel BASE_DATOS_TARIFAS_v1) ────────────────────────────
-- Consumo en kWh (MWh × 1000) para uniformidad con electricity.
-- Precios de potencia/energía en 0 — gas usa fixed_annual_fee_gas + variable_price_kwh_gas.

INSERT INTO lv_zinergia_tarifas (
  company, tipo_cliente, tariff_type, codigo_producto, tariff_name, modelo,
  supply_type,
  consumption_min_kwh, consumption_max_kwh,
  power_price_p1, power_price_p2, power_price_p3,
  power_price_p4, power_price_p5, power_price_p6,
  energy_price_p1, energy_price_p2, energy_price_p3,
  energy_price_p4, energy_price_p5, energy_price_p6,
  fixed_annual_fee_gas, variable_price_kwh_gas,
  notes
) VALUES

-- NATURGY Tarifa Por Uso Gas — 3 tramos por consumo anual
('NATURGY','RESIDENCIAL','RL.1','G0001','Tarifa Por Uso Gas',NULL,'gas',
  0, 5000,
  0,0,0, 0,0,0,
  0,0,0, 0,0,0,
  61.809708, 0.079533,
  '≤5 MWh/año'),

('NATURGY','RESIDENCIAL','RL.2','G0001','Tarifa Por Uso Gas',NULL,'gas',
  5000, 15000,
  0,0,0, 0,0,0,
  0,0,0, 0,0,0,
  109.797624, 0.077434,
  '≤15 MWh/año'),

('NATURGY','RESIDENCIAL','RL.3','G0001','Tarifa Por Uso Gas',NULL,'gas',
  15000, 50000,
  0,0,0, 0,0,0,
  0,0,0, 0,0,0,
  237.116856, 0.073993,
  '≤50 MWh/año')

ON CONFLICT DO NOTHING;


-- ─── 8. COMISIONES (Excel BASE_DATOS_TARIFAS_v1 — hoja COMISIONES) ───────────

INSERT INTO tariff_commissions (
  company, modelo, supply_type, tipo_cliente, producto_tipo,
  consumption_min_mwh, consumption_max_mwh,
  commission_fixed_eur, commission_variable_mwh,
  servicio, notes
) VALUES

-- ── NATURGY PYME — ELECTRICIDAD FIJA ────────────────────────────────────────
('NATURGY','ONE',  'electricity','PYME','ELECTRICIDAD_FIJO',  0, 10,   51.0, 0,    'LUZ','Consumo < 10 MWh/año'),
('NATURGY','BASE', 'electricity','PYME','ELECTRICIDAD_FIJO',  0, 10,   64.0, 0,    'LUZ','Consumo < 10 MWh/año'),
('NATURGY','SUPRA','electricity','PYME','ELECTRICIDAD_FIJO',  0, 10,   72.0, 0,    'LUZ','Consumo < 10 MWh/año'),
('NATURGY','ONE',  'electricity','PYME','ELECTRICIDAD_FIJO', 10, 9999999999, 0, 5.10, 'LUZ','Consumo +10 MWh/año'),
('NATURGY','BASE', 'electricity','PYME','ELECTRICIDAD_FIJO', 10, 9999999999, 0,11.90, 'LUZ','Consumo +10 MWh/año'),
('NATURGY','SUPRA','electricity','PYME','ELECTRICIDAD_FIJO', 10, 9999999999, 0,21.25, 'LUZ','Consumo +10 MWh/año'),

-- ── NATURGY PYME — ELECTRICIDAD VARIABLE ────────────────────────────────────
('NATURGY','ONE',  'electricity','PYME','ELECTRICIDAD_VARIABLE',  0, 10,   51.0, 0,    'LUZ','Consumo < 10 MWh/año'),
('NATURGY','BASE', 'electricity','PYME','ELECTRICIDAD_VARIABLE',  0, 10,   64.0, 0,    'LUZ','Consumo < 10 MWh/año'),
('NATURGY','SUPRA','electricity','PYME','ELECTRICIDAD_VARIABLE',  0, 10,   72.0, 0,    'LUZ','Consumo < 10 MWh/año'),
('NATURGY','ONE',  'electricity','PYME','ELECTRICIDAD_VARIABLE', 10, 9999999999, 0, 5.10, 'LUZ','Consumo +10 MWh/año'),
('NATURGY','BASE', 'electricity','PYME','ELECTRICIDAD_VARIABLE', 10, 9999999999, 0,11.90, 'LUZ','Consumo +10 MWh/año'),
('NATURGY','SUPRA','electricity','PYME','ELECTRICIDAD_VARIABLE', 10, 9999999999, 0,21.25, 'LUZ','Consumo +10 MWh/año'),

-- ── NATURGY PYME — GAS ──────────────────────────────────────────────────────
('NATURGY','ONE',  'gas','PYME','GAS',  0, 15,   13.0, 0,   'GAS','Consumo < 15 MWh/año'),
('NATURGY','BASE', 'gas','PYME','GAS',  0, 15,   13.0, 0,   'GAS','Consumo < 15 MWh/año'),
('NATURGY','SUPRA','gas','PYME','GAS',  0, 15,   26.0, 0,   'GAS','Consumo < 15 MWh/año'),
('NATURGY','ONE',  'gas','PYME','GAS', 15, 9999999999, 0, 4.25, 'GAS','Consumo +15 MWh/año'),
('NATURGY','BASE', 'gas','PYME','GAS', 15, 9999999999, 0, 5.95, 'GAS','Consumo +15 MWh/año'),
('NATURGY','SUPRA','gas','PYME','GAS', 15, 9999999999, 0, 7.65, 'GAS','Consumo +15 MWh/año'),

-- ── NATURGY PYME — GAS VARIABLE ─────────────────────────────────────────────
('NATURGY','ONE',  'gas','PYME','GAS_VARIABLE',  0, 15,   30.0, 0,   'GAS','Consumo < 15 MWh/año'),
('NATURGY','BASE', 'gas','PYME','GAS_VARIABLE',  0, 15,   34.0, 0,   'GAS','Consumo < 15 MWh/año'),
('NATURGY','SUPRA','gas','PYME','GAS_VARIABLE',  0, 15,   38.0, 0,   'GAS','Consumo < 15 MWh/año'),
('NATURGY','ONE',  'gas','PYME','GAS_VARIABLE', 15, 9999999999, 0, 2.55, 'GAS','Consumo +15 MWh/año'),
('NATURGY','BASE', 'gas','PYME','GAS_VARIABLE', 15, 9999999999, 0, 4.25, 'GAS','Consumo +15 MWh/año'),
('NATURGY','SUPRA','gas','PYME','GAS_VARIABLE', 15, 9999999999, 0, 5.95, 'GAS','Consumo +15 MWh/año'),

-- ── NATURGY RESIDENCIAL ──────────────────────────────────────────────────────
('NATURGY',NULL,'electricity','RESIDENCIAL','ELECTRICIDAD', 0,9999999999, 65.0,0, 'LUZ','Tarifa única residencial'),
('NATURGY',NULL,'gas',        'RESIDENCIAL','GAS',          0,9999999999, 65.0,0, 'GAS','Tarifa única residencial'),

-- ── GANA_ENERGIA RESIDENCIAL ─────────────────────────────────────────────────
('GANA_ENERGIA',NULL,'electricity','RESIDENCIAL','ELECTRICIDAD', 0,9999999999, 100.0,0, 'LUZ','Por contrato'),
('GANA_ENERGIA',NULL,'gas',        'RESIDENCIAL','GAS',          0,9999999999, 100.0,0, 'GAS','Por contrato');


-- ─── 9. GRANTS ───────────────────────────────────────────────────────────────
GRANT SELECT ON tariff_commissions TO authenticated;
GRANT SELECT ON tax_parameters     TO authenticated;

-- ─── 10. COMENTARIOS ─────────────────────────────────────────────────────────
COMMENT ON TABLE tariff_commissions IS
  'Comisiones brutas que paga cada comercializadora a Zinergia por contrato firmado. '
  'El reparto con el colaborador se gestiona en commission_rules.collaborator_pct.';

COMMENT ON TABLE tax_parameters IS
  'Parámetros fiscales (IEE, IVA, IGIC) editables por el admin sin tocar código.';

COMMENT ON COLUMN lv_zinergia_tarifas.modelo IS
  'Canal de venta / tier del producto: BASE, ONE, SUPRA. NULL = sin distinción de modelo.';

COMMENT ON COLUMN lv_zinergia_tarifas.supply_type IS
  'Tipo de suministro: electricity (luz) | gas.';

COMMENT ON COLUMN lv_zinergia_tarifas.fixed_annual_fee_gas IS
  'Gas: término fijo anual en €/año (equivale al término de abono).';

COMMENT ON COLUMN lv_zinergia_tarifas.variable_price_kwh_gas IS
  'Gas: término variable en €/kWh consumido.';

COMMENT ON COLUMN commission_rules.collaborator_pct IS
  'Fracción de la comisión bruta (tariff_commissions) que se abona al colaborador. '
  'Ej: 0.50 = el colaborador recibe el 50% de la comisión de la comercializadora.';

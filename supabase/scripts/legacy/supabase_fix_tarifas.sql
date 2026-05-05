-- =============================================
-- ZINERGIA - FIX: COLUMNAS FALTANTES EN TARIFAS
-- =============================================
-- Ejecutar esto PRIMERO si ya existe la tabla lv_zinergia_tarifas
-- =============================================

-- 1. Verificar qué columnas faltan y agregarlas
ALTER TABLE lv_zinergia_tarifas 
    ADD COLUMN IF NOT EXISTS tariff_type TEXT,
    ADD COLUMN IF NOT EXISTS offer_type TEXT CHECK (offer_type IN ('fixed', 'indexed')) DEFAULT 'fixed',
    ADD COLUMN IF NOT EXISTS contract_duration TEXT DEFAULT '12 meses',
    ADD COLUMN IF NOT EXISTS fixed_fee NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS logo_color TEXT DEFAULT 'bg-slate-600',
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Agregar constraint único si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'lv_zinergia_tarifas_company_tariff_name_key'
    ) THEN
        ALTER TABLE lv_zinergia_tarifas 
        ADD CONSTRAINT lv_zinergia_tarifas_company_tariff_name_key 
        UNIQUE (company, tariff_name);
    END IF;
END $$;

-- 3. Actualizar registros existentes si no tienen tariff_type
UPDATE lv_zinergia_tarifas 
SET 
    tariff_type = '2.0TD',
    offer_type = 'fixed',
    contract_duration = '12 meses',
    is_active = TRUE
WHERE tariff_type IS NULL OR tariff_type = '';

-- 4. Eliminar datos existentes si los hay (para evitar duplicados)
-- Esto es opcional, comenta si quieres mantener los datos existentes
DELETE FROM lv_zinergia_tarifas WHERE TRUE;

-- 5. Ahora insertar los datos
-- Insert 2.0TD tariffs (24 from CSV)
INSERT INTO lv_zinergia_tarifas (company, tariff_name, tariff_type, power_price_p1, power_price_p2, power_price_p3, energy_price_p1, energy_price_p2, energy_price_p3, connection_fee) VALUES
    ('GANA ENERGIA', '24 HRS', '2.0TD', 0.089, 0.089, 0.089, 0.111, 0.111, 0.111, 0.6),
    ('GANA ENERGIA', '3 PERIODOS', '2.0TD', 0.089, 0.089, 0.089, 0.163, 0.096, 0.072, 0.6),
    ('WEKIWI', 'IMPULSA ENERGIA', '2.0TD', 0.092, 0.092, 0.092, 0.129, 0.129, 0.129, 0.6),
    ('WEKIWI', 'PROMO', '2.0TD', 0.092, 0.092, 0.092, 0.155, 0.155, 0.155, 0.6),
    ('ENDESA', 'LIBRE CON PERMANENCIA', '2.0TD', 0.088, 0.088, 0.088, 0.109, 0.109, 0.109, 0.6),
    ('ENDESA', 'LIBRE SIN PERMANENCIA', '2.0TD', 0.088, 0.088, 0.088, 0.119, 0.119, 0.119, 0.6),
    ('TOTAL ENERGIES', 'A TU AIRE SIEMPRE', '2.0TD', 0.071, 0.071, 0.071, 0.134, 0.134, 0.134, 0.6),
    ('TOTAL ENERGIES', 'PROGRAMA TU AHORRO', '2.0TD', 0.071, 0.071, 0.071, 0.201, 0.132, 0.096, 0.6),
    ('IBERDROLA', 'ONLINE', '2.0TD', 0.108, 0.046, 0.046, 0.119, 0.119, 0.119, 0.6),
    ('NATURGY', 'POR USO', '2.0TD', 0.1102, 0.03346, 0.03346, 0.1204, 0.1204, 0.1204, 0.6),
    ('NATURGY', 'NOCHE', '2.0TD', 0.1102, 0.03346, 0.03346, 0.1904, 0.1175, 0.082, 0.6),
    ('HOLALUZ', 'HOLA ENERGIA', '2.0TD', 0.096, 0.096, 0.096, 0.13, 0.13, 0.13, 0.6),
    ('ELEIA', 'BALANCE 2', '2.0TD', 0.081, 0.081, 0.081, 0.119, 0.119, 0.119, 0.6),
    ('VISALIA', 'FIJO FLIX', '2.0TD', 0.082, 0.082, 0.082, 0.135, 0.135, 0.135, 0.6),
    ('VISALIA', 'FIJO', '2.0TD', 0.098, 0.098, 0.098, 0.123, 0.123, 0.123, 0.6),
    ('OPCION ENERGIA', 'PRESENCIAL', '2.0TD', 0.111, 0.111, 0.111, 0.116, 0.116, 0.116, 0.6),
    ('IMAGINA', 'UNICO PLUS', '2.0TD', 0.127, 0.059, 0.059, 0.134, 0.134, 0.134, 0.6),
    ('IMAGINA', '3 PERIODOS PLUS', '2.0TD', 0.127, 0.059, 0.059, 0.211, 0.137, 0.102, 0.6),
    ('NORDY', '24 HORAS', '2.0TD', 0.079, 0.079, 0.079, 0.119, 0.119, 0.119, 0.6),
    ('REPSOL', 'FIJO ALTO VALOR', '2.0TD', 0.081, 0.081, 0.081, 0.139, 0.139, 0.139, 0.6),
    ('REPSOL', 'FIJO MEDIO VALOR', '2.0TD', 0.081, 0.081, 0.081, 0.119, 0.119, 0.119, 0.6),
    ('REPSOL', 'FIJO BAJO VALOR', '2.0TD', 0.081, 0.081, 0.081, 0.109, 0.109, 0.109, 0.6),
    ('ENUCA', 'ZURITA', '2.0TD', 0.129, 0.072, 0.072, 0.09, 0.09, 0.09, 0.6),
    ('ENUCA', 'BARROS', '2.0TD', 0.129, 0.072, 0.072, 0.1, 0.1, 0.1, 0.6);

-- Insert 3.0TD and 3.1TD tariffs (10 additional)
INSERT INTO lv_zinergia_tarifas (company, tariff_name, tariff_type, offer_type, power_price_p1, power_price_p2, power_price_p3, power_price_p4, power_price_p5, power_price_p6, energy_price_p1, energy_price_p2, energy_price_p3, energy_price_p4, energy_price_p5, energy_price_p6, connection_fee, logo_color, contract_duration) VALUES
    ('Endesa', 'Conecta 3.0TD', '3.0TD', 'fixed', 0.092, 0.055, 0.035, 0.015, 0.015, 0.015, 0.145, 0.125, 0.115, 0.105, 0.095, 0.095, 0, 'bg-blue-500', '12 meses'),
    ('Iberdrola', 'Plan 3.0TD', '3.0TD', 'fixed', 0.082, 0.052, 0.032, 0.015, 0.015, 0.015, 0.155, 0.135, 0.125, 0.115, 0.105, 0.105, 0, 'bg-green-600', '24 meses'),
    ('Naturgy', 'Tarifa 3.0TD', '3.0TD', 'fixed', 0.095, 0.058, 0.038, 0.018, 0.018, 0.018, 0.138, 0.118, 0.108, 0.098, 0.098, 0.098, 0, 'bg-blue-600', '12 meses'),
    ('Repsol', '3.0TD Empresa', '3.0TD', 'fixed', 0.088, 0.053, 0.033, 0.015, 0.015, 0.015, 0.142, 0.122, 0.112, 0.102, 0.092, 0.092, 0, 'bg-red-600', '12 meses'),
    ('TotalEnergies', '3.0TD Indexada', '3.0TD', 'indexed', 0.072, 0.042, 0.022, 0.012, 0.012, 0.012, 0.135, 0.115, 0.105, 0.095, 0.085, 0.085, 0, 'bg-yellow-500', '12 meses'),
    ('Endesa', 'Conecta 3.1TD', '3.1TD', 'fixed', 0.095, 0.058, 0.038, 0.020, 0.015, 0.010, 0.150, 0.130, 0.120, 0.110, 0.100, 0.090, 0, 'bg-blue-500', '12 meses'),
    ('Iberdrola', 'Plan 3.1TD', '3.1TD', 'fixed', 0.085, 0.055, 0.035, 0.020, 0.015, 0.010, 0.160, 0.140, 0.130, 0.120, 0.110, 0.100, 0, 'bg-green-600', '24 meses'),
    ('Naturgy', 'Tarifa 3.1TD', '3.1TD', 'fixed', 0.098, 0.060, 0.040, 0.022, 0.017, 0.012, 0.143, 0.123, 0.113, 0.103, 0.093, 0.083, 0, 'bg-blue-600', '12 meses'),
    ('Repsol', '3.1TD Empresa', '3.1TD', 'fixed', 0.091, 0.055, 0.035, 0.020, 0.015, 0.010, 0.147, 0.127, 0.117, 0.107, 0.097, 0.087, 0, 'bg-red-600', '12 meses'),
    ('TotalEnergies', '3.1TD Indexada', '3.1TD', 'indexed', 0.075, 0.045, 0.025, 0.015, 0.010, 0.008, 0.140, 0.120, 0.110, 0.100, 0.090, 0.080, 0, 'bg-yellow-500', '12 meses');

-- 6. Crear índices
CREATE INDEX IF NOT EXISTS idx_tarifas_company ON lv_zinergia_tarifas(company);
CREATE INDEX IF NOT EXISTS idx_tarifas_type ON lv_zinergia_tarifas(tariff_type);
CREATE INDEX IF NOT EXISTS idx_tarifas_active ON lv_zinergia_tarifas(is_active);
CREATE INDEX IF NOT EXISTS idx_tarifas_offer_type ON lv_zinergia_tarifas(offer_type);

-- 7. Crear función updated_at si no existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Crear trigger
DROP TRIGGER IF EXISTS update_lv_zinergia_tarifas_updated_at ON lv_zinergia_tarifas;
CREATE TRIGGER update_lv_zinergia_tarifas_updated_at
    BEFORE UPDATE ON lv_zinergia_tarifas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Crear vistas
DROP VIEW IF EXISTS v_active_tariffs;
CREATE OR REPLACE VIEW v_active_tariffs AS
SELECT id, company, tariff_name, tariff_type, offer_type, contract_duration, logo_color,
       power_price_p1, power_price_p2, power_price_p3, power_price_p4, power_price_p5, power_price_p6,
       energy_price_p1, energy_price_p2, energy_price_p3, energy_price_p4, energy_price_p5, energy_price_p6,
       connection_fee, fixed_fee, updated_at
FROM lv_zinergia_tarifas
WHERE is_active = TRUE
ORDER BY company, tariff_name;

DROP VIEW IF EXISTS v_tariff_stats;
CREATE OR REPLACE VIEW v_tariff_stats AS
SELECT tariff_type, offer_type,
       COUNT(*) as total_tariffs,
       COUNT(*) FILTER (WHERE is_active = TRUE) as active_tariffs,
       AVG(power_price_p1) as avg_power_p1,
       AVG(energy_price_p1) as avg_energy_p1,
       AVG(connection_fee) as avg_connection_fee
FROM lv_zinergia_tarifas
GROUP BY tariff_type, offer_type
ORDER BY tariff_type, offer_type;

-- 10. Enable RLS
ALTER TABLE lv_zinergia_tarifas ENABLE ROW LEVEL SECURITY;

-- 11. Crear políticas
DROP POLICY IF EXISTS "Authenticated users can view active tariffs" ON lv_zinergia_tarifas;
CREATE POLICY "Authenticated users can view active tariffs"
    ON lv_zinergia_tarifas FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- 12. Dar permisos
GRANT SELECT ON lv_zinergia_tarifas TO authenticated;
GRANT SELECT ON v_active_tariffs TO authenticated;
GRANT SELECT ON v_tariff_stats TO authenticated;

-- 13. Verificación
SELECT 'lv_zinergia_tarifas' as table_name, COUNT(*) as record_count FROM lv_zinergia_tarifas
UNION ALL
SELECT 'v_active_tariffs', COUNT(*) FROM v_active_tariffs
UNION ALL
SELECT 'v_tariff_stats', COUNT(*) FROM v_tariff_stats;

SELECT company, tariff_name, tariff_type, offer_type
FROM lv_zinergia_tarifas
WHERE is_active = TRUE
ORDER BY tariff_type, company
LIMIT 10;

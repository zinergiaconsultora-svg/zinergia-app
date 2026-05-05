-- =============================================
-- ZINERGIA - RECREAR TABLA TARIFAS DESDE CERO
-- =============================================
-- ESTE SCRIPT ELIMINA LA TABLA EXISTENTE Y LA CREA NUEVA
-- =============================================

-- 1. ELIMINAR todo lo relacionado con tarifas
DROP TABLE IF EXISTS lv_zinergia_tarifas CASCADE;
DROP VIEW IF EXISTS v_active_tariffs CASCADE;
DROP VIEW IF EXISTS v_tariff_stats CASCADE;

-- 2. CREAR la tabla con la estructura CORRECTA
CREATE TABLE lv_zinergia_tarifas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Identificación
    company TEXT NOT NULL,
    tariff_name TEXT NOT NULL,
    tariff_type TEXT,
    
    -- Tipo de tarifa
    offer_type TEXT CHECK (offer_type IN ('fixed', 'indexed')) DEFAULT 'fixed',
    contract_duration TEXT DEFAULT '12 meses',
    
    -- Precios de potencia (€/kW/día) - P1 a P6
    power_price_p1 NUMERIC NOT NULL DEFAULT 0,
    power_price_p2 NUMERIC NOT NULL DEFAULT 0,
    power_price_p3 NUMERIC NOT NULL DEFAULT 0,
    power_price_p4 NUMERIC NOT NULL DEFAULT 0,
    power_price_p5 NUMERIC NOT NULL DEFAULT 0,
    power_price_p6 NUMERIC NOT NULL DEFAULT 0,
    
    -- Precios de energía (€/kWh) - P1 a P6
    energy_price_p1 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p2 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p3 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p4 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p5 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p6 NUMERIC NOT NULL DEFAULT 0,
    
    -- Costos fijos
    connection_fee NUMERIC DEFAULT 0,
    fixed_fee NUMERIC DEFAULT 0,
    
    -- Metadatos
    logo_color TEXT DEFAULT 'bg-slate-600',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Restricción única
    CONSTRAINT unique_tariff UNIQUE (company, tariff_name)
);

-- 3. INSERTAR las 24 tarifas 2.0TD
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

-- 4. INSERTAR las 10 tarifas 3.0TD y 3.1TD
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

-- 5. CREAR índices
CREATE INDEX idx_tarifas_company ON lv_zinergia_tarifas(company);
CREATE INDEX idx_tarifas_type ON lv_zinergia_tarifas(tariff_type);
CREATE INDEX idx_tarifas_active ON lv_zinergia_tarifas(is_active);

-- 6. CREAR función para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. CREAR trigger
CREATE TRIGGER update_lv_zinergia_tarifas_updated_at
    BEFORE UPDATE ON lv_zinergia_tarifas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. CREAR vistas
CREATE OR REPLACE VIEW v_active_tariffs AS
SELECT id, company, tariff_name, tariff_type, offer_type, contract_duration, logo_color,
       power_price_p1, power_price_p2, power_price_p3, power_price_p4, power_price_p5, power_price_p6,
       energy_price_p1, energy_price_p2, energy_price_p3, energy_price_p4, energy_price_p5, energy_price_p6,
       connection_fee, fixed_fee, updated_at
FROM lv_zinergia_tarifas
WHERE is_active = TRUE
ORDER BY company, tariff_name;

CREATE OR REPLACE VIEW v_tariff_stats AS
SELECT tariff_type, offer_type,
       COUNT(*) as total_tariffs,
       AVG(power_price_p1) as avg_power_p1,
       AVG(energy_price_p1) as avg_energy_p1,
       AVG(connection_fee) as avg_connection_fee
FROM lv_zinergia_tarifas
GROUP BY tariff_type, offer_type
ORDER BY tariff_type, offer_type;

-- 9. ENABLE RLS
ALTER TABLE lv_zinergia_tarifas ENABLE ROW LEVEL SECURITY;

-- 10. CREAR políticas
CREATE POLICY "Authenticated users can view active tariffs"
    ON lv_zinergia_tarifas FOR SELECT 
    USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- 11. GRANT permisos
GRANT SELECT ON lv_zinergia_tarifas TO authenticated;
GRANT SELECT ON v_active_tariffs TO authenticated;
GRANT SELECT ON v_tariff_stats TO authenticated;

-- 12. VERIFICACIÓN
SELECT '✅ TABLA CREADA CORRECTAMENTE' as status;
SELECT 'lv_zinergia_tarifas' as table_name, COUNT(*) as total_records FROM lv_zinergia_tarifas
UNION ALL
SELECT 'v_active_tariffs', COUNT(*) FROM v_active_tariffs;

SELECT '📊 MUESTRA DE TARIFAS (10 primeras):' as info;
SELECT company, tariff_name, tariff_type, offer_type, 
       power_price_p1, energy_price_p1
FROM lv_zinergia_tarifas
ORDER BY tariff_type, company
LIMIT 10;

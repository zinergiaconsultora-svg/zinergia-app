-- Plenitude electricity fixed tariffs from "TARIFAS PLENITUDE.pdf".
-- Entrada en vigor: 2026-04-27.
-- Only fixed products are loaded: FACIL 3.0TD, PERIODOS 3.0TD and FIJO 6.1TD.
-- INDEX 3.0TD, INDEX 6.1TD, gas and services are intentionally excluded.

DELETE FROM public.lv_zinergia_tarifas
WHERE company = 'Plenitude'
  AND supply_type = 'electricity'
  AND codigo_producto IN ('FACIL', 'PERIODOS', 'FIJO')
  AND tariff_type IN ('3.0TD', '6.1TD');

INSERT INTO public.lv_zinergia_tarifas (
    company,
    tariff_name,
    tariff_type,
    offer_type,
    contract_duration,
    power_price_p1,
    power_price_p2,
    power_price_p3,
    power_price_p4,
    power_price_p5,
    power_price_p6,
    energy_price_p1,
    energy_price_p2,
    energy_price_p3,
    energy_price_p4,
    energy_price_p5,
    energy_price_p6,
    logo_color,
    supply_type,
    modelo,
    tipo_cliente,
    codigo_producto,
    notes,
    is_active
) VALUES
    ('Plenitude', 'POWER +', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.012278, 0.010647, 0.006887, 0.003951, 0.162381, 0.162381, 0.162381, 0.162381, 0.162381, 0.162381, 'bg-emerald-600', 'electricity', 'FACIL', 'PYME', 'FACIL', 'FACIL 3.0TD. Energia tomada de Precio Final Energia con 15% dto.', true),
    ('Plenitude', 'POWER', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.012278, 0.010647, 0.006887, 0.003951, 0.157306, 0.157306, 0.157306, 0.157306, 0.157306, 0.157306, 'bg-emerald-600', 'electricity', 'FACIL', 'PYME', 'FACIL', 'FACIL 3.0TD. Energia tomada de Precio Final Energia con 15% dto.', true),
    ('Plenitude', 'ENERGY +', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.026182, 0.024551, 0.026353, 0.023417, 0.138021, 0.138021, 0.138021, 0.138021, 0.138021, 0.138021, 'bg-emerald-600', 'electricity', 'FACIL', 'PYME', 'FACIL', 'FACIL 3.0TD. Energia tomada de Precio Final Energia con 15% dto.', true),
    ('Plenitude', 'ENERGY', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.023401, 0.021770, 0.020791, 0.017855, 0.138021, 0.138021, 0.138021, 0.138021, 0.138021, 0.138021, 'bg-emerald-600', 'electricity', 'FACIL', 'PYME', 'FACIL', 'FACIL 3.0TD. Energia tomada de Precio Final Energia con 15% dto.', true),
    ('Plenitude', 'PRIME', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.017839, 0.016209, 0.020791, 0.017855, 0.145126, 0.145126, 0.145126, 0.145126, 0.145126, 0.145126, 'bg-emerald-600', 'electricity', 'FACIL', 'PYME', 'FACIL', 'FACIL 3.0TD. PRIME usa Precio Final Energia sin dto porque no aplica descuento.', true),

    ('Plenitude', 'POWER +', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.012278, 0.010647, 0.006887, 0.003951, 0.246066, 0.212546, 0.184761, 0.162663, 0.140641, 0.154914, 'bg-emerald-600', 'electricity', 'PERIODOS', 'PYME', 'PERIODOS', 'PERIODOS 3.0TD. Energia tomada de Termino de Energia 2% con Peajes y Cargos.', true),
    ('Plenitude', 'POWER', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.012278, 0.010647, 0.006887, 0.003951, 0.231856, 0.198336, 0.170551, 0.148453, 0.126431, 0.140704, 'bg-emerald-600', 'electricity', 'PERIODOS', 'PYME', 'PERIODOS', 'PERIODOS 3.0TD. Energia tomada de Termino de Energia 2% con Peajes y Cargos.', true),
    ('Plenitude', 'ENERGY +', '3.0TD', 'fixed', '12 meses', 0.058608, 0.034651, 0.023401, 0.024551, 0.026353, 0.026198, 0.227796, 0.194276, 0.166491, 0.144393, 0.122371, 0.136644, 'bg-emerald-600', 'electricity', 'PERIODOS', 'PYME', 'PERIODOS', 'PERIODOS 3.0TD. Energia tomada de Termino de Energia 2% con Peajes y Cargos.', true),
    ('Plenitude', 'ENERGY', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.023401, 0.021770, 0.020791, 0.017855, 0.220691, 0.187171, 0.159386, 0.137288, 0.115266, 0.129539, 'bg-emerald-600', 'electricity', 'PERIODOS', 'PYME', 'PERIODOS', 'PERIODOS 3.0TD. Energia tomada de Termino de Energia 2% con Peajes y Cargos.', true),
    ('Plenitude', 'BASSIC', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.012278, 0.010647, 0.006887, 0.003951, 0.207466, 0.173946, 0.146161, 0.124063, 0.102041, 0.116314, 'bg-emerald-600', 'electricity', 'PERIODOS', 'PYME', 'PERIODOS', 'PERIODOS 3.0TD. Nombre BASSIC mantenido con dos S segun PDF.', true),
    ('Plenitude', 'BASSIC 24M', '3.0TD', 'fixed', '24 meses', 0.055827, 0.029089, 0.012278, 0.010647, 0.007721, 0.004785, 0.196528, 0.164181, 0.135233, 0.113428, 0.099302, 0.103139, 'bg-emerald-600', 'electricity', 'PERIODOS', 'PYME', 'PERIODOS', 'PERIODOS 3.0TD. Nombre BASSIC mantenido con dos S segun PDF.', true),
    ('Plenitude', 'BASSIC 36M', '3.0TD', 'fixed', '36 meses', 0.055827, 0.029089, 0.012278, 0.010647, 0.006887, 0.003951, 0.176544, 0.148434, 0.125652, 0.112824, 0.101523, 0.102976, 'bg-emerald-600', 'electricity', 'PERIODOS', 'PYME', 'PERIODOS', 'PERIODOS 3.0TD. Nombre BASSIC mantenido con dos S segun PDF.', true),
    ('Plenitude', 'BASSIC 60M', '3.0TD', 'fixed', '60 meses', 0.055827, 0.029089, 0.012278, 0.010647, 0.006887, 0.003951, 0.174514, 0.146404, 0.123622, 0.110794, 0.099493, 0.100946, 'bg-emerald-600', 'electricity', 'PERIODOS', 'PYME', 'PERIODOS', 'PERIODOS 3.0TD. Nombre BASSIC mantenido con dos S segun PDF.', true),
    ('Plenitude', 'CUSTOM 80', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.023401, 0.021770, 0.020791, 0.017855, 0.207466, 0.173946, 0.146161, 0.124063, 0.102041, 0.116314, 'bg-emerald-600', 'electricity', 'PERIODOS', 'PYME', 'PERIODOS', 'PERIODOS 3.0TD. Energia tomada de Precio Final Energia GO 2 EUR/MWh minimo.', true),
    ('Plenitude', 'CUSTOM 100', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.031743, 0.030113, 0.029133, 0.026198, 0.207466, 0.173946, 0.146161, 0.124063, 0.102041, 0.116314, 'bg-emerald-600', 'electricity', 'PERIODOS', 'PYME', 'PERIODOS', 'PERIODOS 3.0TD. Energia tomada de Precio Final Energia GO 2 EUR/MWh minimo.', true),

    ('Plenitude', 'POWER +', '6.1TD', 'fixed', '12 meses', 0.081083, 0.042506, 0.018635, 0.014777, 0.005822, 0.002751, 0.201976, 0.174609, 0.155214, 0.136801, 0.117616, 0.127205, 'bg-emerald-600', 'electricity', 'FIJO', 'PYME', 'FIJO', 'FIJO 6.1TD. Energia tomada de Termino de Energia 2% con Peajes y Cargos.', true),
    ('Plenitude', 'POWER', '6.1TD', 'fixed', '12 meses', 0.081083, 0.042506, 0.018635, 0.014777, 0.005822, 0.002751, 0.190811, 0.163444, 0.144049, 0.125636, 0.106451, 0.116040, 'bg-emerald-600', 'electricity', 'FIJO', 'PYME', 'FIJO', 'FIJO 6.1TD. Energia tomada de Termino de Energia 2% con Peajes y Cargos.', true),
    ('Plenitude', 'ENERGY +', '6.1TD', 'fixed', '12 meses', 0.083864, 0.048067, 0.029758, 0.028681, 0.025287, 0.024997, 0.190811, 0.163444, 0.144049, 0.125636, 0.106451, 0.116040, 'bg-emerald-600', 'electricity', 'FIJO', 'PYME', 'FIJO', 'FIJO 6.1TD. Energia tomada de Termino de Energia 2% con Peajes y Cargos.', true),
    ('Plenitude', 'ENERGY', '6.1TD', 'fixed', '12 meses', 0.081083, 0.042506, 0.029758, 0.025900, 0.019726, 0.016655, 0.183706, 0.156339, 0.136944, 0.118531, 0.099346, 0.108935, 'bg-emerald-600', 'electricity', 'FIJO', 'PYME', 'FIJO', 'FIJO 6.1TD. Energia tomada de Termino de Energia 2% con Peajes y Cargos.', true),
    ('Plenitude', 'BASSIC', '6.1TD', 'fixed', '12 meses', 0.081083, 0.042506, 0.018635, 0.014777, 0.005822, 0.002751, 0.176571, 0.149204, 0.129809, 0.111396, 0.092211, 0.101800, 'bg-emerald-600', 'electricity', 'FIJO', 'PYME', 'FIJO', 'FIJO 6.1TD. Nombre BASSIC mantenido con dos S segun PDF.', true),
    ('Plenitude', 'BASSIC 36M', '6.1TD', 'fixed', '36 meses', 0.081083, 0.042506, 0.018635, 0.014777, 0.005822, 0.002751, 0.146773, 0.124785, 0.110373, 0.100993, 0.090735, 0.091984, 'bg-emerald-600', 'electricity', 'FIJO', 'PYME', 'FIJO', 'FIJO 6.1TD. Nombre BASSIC mantenido con dos S segun PDF.', true),
    ('Plenitude', 'BASSIC 60M', '6.1TD', 'fixed', '60 meses', 0.081083, 0.042506, 0.018635, 0.014777, 0.005822, 0.002751, 0.144743, 0.122755, 0.108343, 0.098963, 0.088705, 0.089954, 'bg-emerald-600', 'electricity', 'FIJO', 'PYME', 'FIJO', 'FIJO 6.1TD. Nombre BASSIC mantenido con dos S segun PDF.', true),
    ('Plenitude', 'CUSTOM 80', '6.1TD', 'fixed', '12 meses', 0.081083, 0.042506, 0.029758, 0.025900, 0.019726, 0.016655, 0.176571, 0.149204, 0.129809, 0.111396, 0.092211, 0.101800, 'bg-emerald-600', 'electricity', 'FIJO', 'PYME', 'FIJO', 'FIJO 6.1TD. Energia tomada de Precio Final Energia GO 2 EUR/MWh minimo.', true),
    ('Plenitude', 'CUSTOM 100', '6.1TD', 'fixed', '12 meses', 0.081083, 0.042506, 0.038101, 0.034243, 0.028068, 0.024997, 0.176571, 0.149204, 0.129809, 0.111396, 0.092211, 0.101800, 'bg-emerald-600', 'electricity', 'FIJO', 'PYME', 'FIJO', 'FIJO 6.1TD. Energia tomada de Precio Final Energia GO 2 EUR/MWh minimo.', true);

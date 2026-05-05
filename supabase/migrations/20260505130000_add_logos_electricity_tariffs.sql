-- LOGOS electricity fixed tariffs from "PRECIOS LOGOS 21.04.2026.pdf".
-- Entrada en vigor: 2026-04-21.
-- Only FIJO PYME electricity products are loaded.
-- FIJO HOGAR, FIJO HOGAR GAS, FIJO PYME GAS and all gas RL.* products are intentionally excluded.
-- ALFA/ZEUS is intentionally excluded because it is not functional for the current app flow.

DELETE FROM public.lv_zinergia_tarifas
WHERE company = 'LOGOS'
  AND supply_type = 'electricity'
  AND modelo = 'FIJO PYME';

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
    ('LOGOS', 'ZEUS UNICO', '3.0TD', 'fixed', '12 meses', 0.055827, 0.029089, 0.012278, 0.010647, 0.006887, 0.003951, 0.135520, 0.135520, 0.135520, 0.135520, 0.135520, 0.135520, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'ZEUS_UNICO', 'FIJO PYME electricidad. Precio unico de energia aplicado a P1-P6. Hogar y gas excluidos.', true),

    ('LOGOS', 'SIGMA', '2.0TD', 'fixed', '12 meses', 0.103300, 0.029385, 0.000000, 0.000000, 0.000000, 0.000000, 0.255564, 0.181597, 0.147829, 0.000000, 0.000000, 0.000000, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'SIGMA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'SIGMA', '3.0TD', 'fixed', '12 meses', 0.077745, 0.051007, 0.034196, 0.032565, 0.028805, 0.025869, 0.225664, 0.191405, 0.176576, 0.156290, 0.135113, 0.144880, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'SIGMA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'SIGMA', '6.1TD', 'fixed', '12 meses', 0.103001, 0.064424, 0.040553, 0.036695, 0.027740, 0.024669, 0.198325, 0.169420, 0.161640, 0.145402, 0.125029, 0.134058, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'SIGMA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),

    ('LOGOS', 'OMEGA', '2.0TD', 'fixed', '12 meses', 0.092341, 0.018426, 0.000000, 0.000000, 0.000000, 0.000000, 0.251564, 0.177597, 0.143829, 0.000000, 0.000000, 0.000000, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'OMEGA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'OMEGA', '3.0TD', 'fixed', '12 meses', 0.072266, 0.045528, 0.028717, 0.027086, 0.023326, 0.020390, 0.218664, 0.184405, 0.169576, 0.149290, 0.128113, 0.137880, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'OMEGA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'OMEGA', '6.1TD', 'fixed', '12 meses', 0.097522, 0.058944, 0.035074, 0.031216, 0.022261, 0.019190, 0.191325, 0.162420, 0.154640, 0.138402, 0.118029, 0.127058, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'OMEGA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),

    ('LOGOS', 'EPSILON', '2.0TD', 'fixed', '12 meses', 0.086861, 0.012946, 0.000000, 0.000000, 0.000000, 0.000000, 0.240564, 0.166597, 0.132829, 0.000000, 0.000000, 0.000000, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'EPSILON', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'EPSILON', '3.0TD', 'fixed', '12 meses', 0.066786, 0.040048, 0.023237, 0.021606, 0.017846, 0.014910, 0.211664, 0.177405, 0.162576, 0.142290, 0.121113, 0.130880, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'EPSILON', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'EPSILON', '6.1TD', 'fixed', '12 meses', 0.092042, 0.053465, 0.029594, 0.025737, 0.016781, 0.013710, 0.185325, 0.156420, 0.148640, 0.132402, 0.112029, 0.121058, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'EPSILON', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),

    ('LOGOS', 'DELTA', '2.0TD', 'fixed', '12 meses', 0.086861, 0.012946, 0.000000, 0.000000, 0.000000, 0.000000, 0.233564, 0.159597, 0.125829, 0.000000, 0.000000, 0.000000, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'DELTA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'DELTA', '3.0TD', 'fixed', '12 meses', 0.066786, 0.040048, 0.023237, 0.021606, 0.017846, 0.014910, 0.205664, 0.171405, 0.156576, 0.136290, 0.115113, 0.124880, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'DELTA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'DELTA', '6.1TD', 'fixed', '12 meses', 0.092042, 0.053465, 0.029594, 0.025737, 0.016781, 0.013710, 0.178325, 0.149420, 0.141640, 0.125402, 0.105029, 0.114058, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'DELTA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),

    ('LOGOS', 'GAMMA', '2.0TD', 'fixed', '12 meses', 0.084122, 0.010207, 0.000000, 0.000000, 0.000000, 0.000000, 0.232064, 0.158097, 0.124329, 0.000000, 0.000000, 0.000000, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'GAMMA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'GAMMA', '3.0TD', 'fixed', '12 meses', 0.064046, 0.037309, 0.020497, 0.018867, 0.015106, 0.012171, 0.202664, 0.168405, 0.153576, 0.133290, 0.112113, 0.121880, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'GAMMA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'GAMMA', '6.1TD', 'fixed', '12 meses', 0.089302, 0.050725, 0.026854, 0.022997, 0.014041, 0.010970, 0.174325, 0.145420, 0.137640, 0.121402, 0.101029, 0.110058, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'GAMMA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),

    ('LOGOS', 'BETA', '2.0TD', 'fixed', '12 meses', 0.081382, 0.007467, 0.000000, 0.000000, 0.000000, 0.000000, 0.230564, 0.156597, 0.122829, 0.000000, 0.000000, 0.000000, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'BETA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'BETA', '3.0TD', 'fixed', '12 meses', 0.061307, 0.034569, 0.017758, 0.016127, 0.012367, 0.009431, 0.198664, 0.164405, 0.149576, 0.129290, 0.108113, 0.117880, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'BETA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true),
    ('LOGOS', 'BETA', '6.1TD', 'fixed', '12 meses', 0.086563, 0.047986, 0.024115, 0.020257, 0.011302, 0.008231, 0.172325, 0.143420, 0.135640, 0.119402, 0.099029, 0.108058, 'bg-slate-700', 'electricity', 'FIJO PYME', 'PYME', 'BETA', 'FIJO PYME electricidad. Hogar y gas excluidos.', true);

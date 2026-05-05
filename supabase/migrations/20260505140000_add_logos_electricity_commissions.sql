-- LOGOS electricity commission bands from "Logos.pdf".
-- Only business fixed electricity commissions are loaded: FIJO 3.0TD and FIJO 6.1TD.
-- FIJO 2.0TD, all INDEXADO tables, Electricidad Hogar, gas PYME/CCPP, gas FIJO HOGAR and services are excluded.
-- Annual consumption must be resolved in MWh, preferably via SIPS/CNMC from the invoice CUPS.

DELETE FROM public.tariff_commissions
WHERE company = 'LOGOS'
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
    'LOGOS',
    tariff_type,
    'electricity',
    'PYME',
    product,
    min_mwh,
    COALESCE(max_mwh, 9999999999),
    commission_eur,
    0,
    'LUZ',
    'Comisiones LOGOS Negocio FIJO. Tramo calculado por consumo anual MWh via SIPS/CNMC cuando haya CUPS.',
    true
FROM (
    VALUES
    ('3.0TD',0,5,159.00,120.75,98.25,83.25,47.25,206.25),
    ('3.0TD',5,10,256.50,201.00,164.25,135.75,93.75,333.75),
    ('3.0TD',10,20,370.50,248.25,181.50,154.50,124.50,481.50),
    ('3.0TD',20,30,538.50,431.25,349.50,264.00,150.00,700.50),
    ('3.0TD',30,40,681.00,534.75,409.50,315.00,178.50,885.75),
    ('3.0TD',40,50,862.50,627.00,484.50,370.50,259.50,1120.50),
    ('3.0TD',50,70,1083.00,814.50,643.50,506.25,324.00,1407.75),
    ('3.0TD',70,100,1567.50,1147.50,912.00,698.25,459.75,2037.75),
    ('3.0TD',100,150,2244.75,1642.50,1282.50,897.75,521.25,2917.50),
    ('3.0TD',150,200,2926.50,1826.25,1626.00,1168.50,623.25,3804.00),
    ('3.0TD',200,300,4292.25,2563.50,2223.00,1616.25,1083.00,5580.00),
    ('3.0TD',300,400,6300.75,3833.25,2565.00,2265.75,1706.25,8190.75),
    ('3.0TD',400,500,7228.50,4293.75,3000.00,2601.00,1941.75,9396.75),
    ('3.0TD',500,700,9681.75,6031.50,4107.00,3664.50,2422.50,12585.75),
    ('3.0TD',700,1200,13763.25,7345.50,6355.50,5229.75,3990.00,17892.00),
    ('3.0TD',1200,NULL,16886.25,9654.75,8016.00,7125.00,5913.75,21952.50),

    ('6.1TD',0,5,135.75,113.25,98.25,80.25,48.00,204.00),
    ('6.1TD',5,10,227.25,189.00,158.25,131.25,84.00,340.50),
    ('6.1TD',10,20,288.75,240.75,180.00,157.50,117.00,432.75),
    ('6.1TD',20,30,534.75,435.00,345.75,264.00,141.00,801.75),
    ('6.1TD',30,40,649.50,527.25,395.25,317.25,180.75,975.00),
    ('6.1TD',40,50,758.25,616.50,479.25,378.00,252.75,1137.00),
    ('6.1TD',50,70,1007.25,791.25,631.50,488.25,318.00,1511.25),
    ('6.1TD',70,100,1470.00,1125.75,912.00,655.50,381.00,2204.25),
    ('6.1TD',100,150,1923.75,1567.50,1264.50,933.75,506.25,2886.00),
    ('6.1TD',150,200,2370.00,1975.50,1624.50,1278.75,639.75,3555.00),
    ('6.1TD',200,300,3151.50,2626.50,1917.00,1566.00,962.25,4727.25),
    ('6.1TD',300,400,4634.25,3861.75,2778.75,2337.00,1699.50,6951.00),
    ('6.1TD',400,500,6505.50,5115.75,3755.25,3149.25,2184.00,9759.00),
    ('6.1TD',500,700,8059.50,6483.75,4382.25,3975.75,2996.25,12089.25),
    ('6.1TD',700,1200,9661.50,8051.25,6056.25,5151.75,4311.00,14493.00),
    ('6.1TD',1200,2500,15932.25,12276.50,10509.75,8977.50,8193.75,23898.00),
    ('6.1TD',2500,NULL,20691.00,17242.50,13893.75,12682.50,11499.75,31036.50)
) AS bands(
    tariff_type,
    min_mwh,
    max_mwh,
    omega_eur,
    epsilon_eur,
    delta_eur,
    gamma_eur,
    beta_eur,
    sigma_eur
)
CROSS JOIN LATERAL (
    VALUES
        ('OMEGA', omega_eur),
        ('EPSILON', epsilon_eur),
        ('DELTA', delta_eur),
        ('GAMMA', gamma_eur),
        ('BETA', beta_eur),
        ('SIGMA', sigma_eur)
) AS products(product, commission_eur);

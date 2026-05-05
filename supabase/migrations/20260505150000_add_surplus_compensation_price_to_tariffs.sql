ALTER TABLE public.lv_zinergia_tarifas
ADD COLUMN IF NOT EXISTS surplus_compensation_price numeric DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.lv_zinergia_tarifas.surplus_compensation_price
IS 'Electricidad: precio de compensacion de excedentes de autoconsumo en EUR/kWh. 0 = no configurado.';

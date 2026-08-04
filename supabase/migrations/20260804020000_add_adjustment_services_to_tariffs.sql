-- Adjustment services (servicios de ajuste, SSA) on the tariff catalogue.
--
-- SSA are a variable system cost and the market treats them in three incompatible ways:
-- bundled into the energy price, billed separately on top, or bundled up to a cap with the
-- excess passed through to the client. Comparing an offer that bundles them against one
-- that bills them separately, without normalising, overstates the second offer's saving by
-- the whole SSA amount - roughly 12-21 EUR/MWh depending on the marketer.
--
-- The client discovers the gap on the first invoice. In this system that path is already
-- modelled: reclamacion -> early termination -> commission_decommission_bands -> clawback.
-- So this is a correctness fix, not a feature.
--
-- Additive and safe: the default is 'unknown', which adds no cost and makes the comparator
-- raise `missing_ssa_treatment`. A silent zero would be indistinguishable from 'included',
-- which is exactly the confusion this column exists to remove.

BEGIN;

ALTER TABLE public.lv_zinergia_tarifas
    ADD COLUMN IF NOT EXISTS ssa_treatment text NOT NULL DEFAULT 'unknown';

ALTER TABLE public.lv_zinergia_tarifas
    ADD COLUMN IF NOT EXISTS ssa_included_eur_mwh numeric NOT NULL DEFAULT 0;

ALTER TABLE public.lv_zinergia_tarifas
    DROP CONSTRAINT IF EXISTS lv_zinergia_tarifas_ssa_treatment_check;

ALTER TABLE public.lv_zinergia_tarifas
    ADD CONSTRAINT lv_zinergia_tarifas_ssa_treatment_check CHECK (
        ssa_treatment IN ('unknown', 'included', 'billed_separately', 'included_with_cap')
    );

-- A cap is only meaningful for the capped treatment, and it must be present when that
-- treatment is selected. Anything else is a configuration mistake that would silently
-- price the excess as if the cap were zero.
ALTER TABLE public.lv_zinergia_tarifas
    DROP CONSTRAINT IF EXISTS lv_zinergia_tarifas_ssa_cap_shape_check;

ALTER TABLE public.lv_zinergia_tarifas
    ADD CONSTRAINT lv_zinergia_tarifas_ssa_cap_shape_check CHECK (
        (ssa_treatment = 'included_with_cap' AND ssa_included_eur_mwh > 0)
        OR (ssa_treatment <> 'included_with_cap' AND ssa_included_eur_mwh = 0)
    );

COMMENT ON COLUMN public.lv_zinergia_tarifas.ssa_treatment IS
    'Como trata la comercializadora los servicios de ajuste: unknown (sin configurar, la comparativa avisa) | included | billed_separately | included_with_cap.';
COMMENT ON COLUMN public.lv_zinergia_tarifas.ssa_included_eur_mwh IS
    'Techo de servicios de ajuste incluido en el precio de energia, en EUR/MWh. Solo aplica a included_with_cap; 0 en el resto.';

COMMIT;

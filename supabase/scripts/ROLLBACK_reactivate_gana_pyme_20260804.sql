-- ROLLBACK for the 2026-08-04 deactivation of the GANA PYME tariffs.
--
-- Why they were deactivated: both were active and sellable, but GANA has no PYME
-- commission rules under either spelling of its name ('GANA ENERGIA' with a space holds the
-- PYME tariffs, 'GANA_ENERGIA' with an underscore holds the RESIDENCIAL ones, and only the
-- latter has rules, all of them RESIDENCIAL). An agent could compare, propose and close
-- either tariff and earn nothing, with the comparator showing only "Pendiente".
--
-- Coverage of active PYME commission rules at the time:
--   LOGOS 198 · Plenitude 126 · NATURGY 24 · GANA 0
--
-- Deactivated (both were is_active = true):
--   015f88f0-cbb2-47ba-a434-1df3882cb338  GANA ENERGIA :: Fijo 24h                2.0TD PYME
--   31a282e9-f520-4599-9320-d0bbea825bd0  GANA ENERGIA :: Tarifa tramos horarios  2.0TD PYME
--
-- DO NOT run this until GANA's PYME commission rules exist in public.tariff_commissions.
-- Reactivating them beforehand simply restores the original problem.

UPDATE public.lv_zinergia_tarifas
SET is_active = true
WHERE id IN (
    '015f88f0-cbb2-47ba-a434-1df3882cb338',
    '31a282e9-f520-4599-9320-d0bbea825bd0'
)
  AND is_active = false;

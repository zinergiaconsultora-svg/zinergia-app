# Archived migrations (pre-baseline)

These 5 migration files predate the baseline migration `20260420_baseline.sql`.

**They are not applied anymore.** Their content is already subsumed by the baseline — the baseline was generated via `pg_dump` against the production database in its current state, which reflects these migrations plus all the manual schema changes that happened outside git.

## Why kept

For historical reference only:
- To see how each area of the schema evolved before the baseline.
- To diff against the current state if an old intent needs recovering.

## How schema changes happen now

See [../../CLAUDE.md](../../../CLAUDE.md) — section "Database schema changes — MANDATORY workflow".

Short version: new migration files go in `supabase/migrations/` (not here), with timestamp prefix `YYYYMMDD_description.sql`.

## Files

| File | Date | Content |
|------|------|---------|
| `20260327_commission_rules.sql` | 2026-03-27 | Initial commission_rules table + policies |
| `20260401_tariff_model_v2.sql` | 2026-04-01 | Tariff model v2 |
| `20260401_tariff_fixes.sql` | 2026-04-01 | Tariff model fixes |
| `20260401_deactivate_mock_tariffs.sql` | 2026-04-01 | Disable mock tariff data |
| `20260407_ocr_training_examples.sql` | 2026-04-07 | OCR training examples table |

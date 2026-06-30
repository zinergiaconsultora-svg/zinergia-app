# Migration Checklist

## Migration

- File: `supabase/migrations/<timestamp>_<description>.sql`
- Purpose:
- Tables:
- Policies:
- Functions:
- Triggers:
- Indexes:

## Required Checks

- [ ] Migration is idempotent where appropriate.
- [ ] RLS is enabled for new tables where applicable.
- [ ] Policies cover Admin, Franchise and Agent behavior.
- [ ] No manual dashboard-only change is required.
- [ ] Types regenerated into `src/types/database.types.ts`.
- [ ] Rollback plan documented.

## Commands

```powershell
npx supabase db push
npx supabase gen types typescript --project-id gmjgkzaxmkaggsyczwcm | Set-Content -LiteralPath 'src\types\database.types.ts' -Encoding utf8
```

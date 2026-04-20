# Zinergia — Project-specific rules for Claude

This file documents rules specific to the Zinergia codebase. Global rules live in `~/.claude/rules/` and always apply on top of this file.

---

## 🔴 Database schema changes — MANDATORY workflow

> **As of 2026-04-20, ALL database schema changes must go through a migration file in `supabase/migrations/`.**
> **Manual edits on the Supabase dashboard are prohibited.**

### Why

Until now, schema drift was rampant: 5 migrations in git vs. a 1,500-line `database.types.ts` reflecting a much larger real schema. This made new environments unreproducible and rollbacks impossible.

The baseline `supabase/migrations/20260420_baseline.sql` captures the full production schema as of 2026-04-20 (24 tables, 58 RLS policies, 9 functions, 11 triggers, 41 indexes).

### The flow for ANY schema change

1. Write a new migration file: `supabase/migrations/YYYYMMDD_description.sql`.
2. Review it like any other code — schema changes are CRITICAL.
3. Apply locally via `supabase db push` (or test in a staging project).
4. Regenerate types: `npx supabase gen types typescript --project-id gmjgkzaxmkaggsyczwcm > src/types/database.types.ts`.
5. Commit both the migration and the regenerated types together.

### What counts as a "schema change"

- `CREATE / ALTER / DROP TABLE`
- `CREATE / DROP POLICY` (RLS)
- `CREATE / REPLACE / DROP FUNCTION`
- `CREATE / DROP TRIGGER`
- `CREATE / DROP INDEX`
- Column default changes
- Constraint additions/removals
- Extension additions

### What does NOT go through migrations

- Data seeding for dev/test fixtures (use `supabase/seed.sql` or test helpers)
- One-off data repairs (use a SQL script in `supabase/scripts/` with a clear timestamped name)
- Anything in `auth.*`, `storage.*`, `realtime.*` schemas — those are managed by Supabase

### Archived pre-baseline migrations

The 5 migrations from before 2026-04-20 live in `supabase/migrations/_archive/`. They are **not re-applied** — their content is already included in the baseline. Kept for historical reference only.

---

## Project context (summary for Claude)

- **Stack:** Next.js 16 (App Router) + React + TypeScript + Supabase (Postgres + Auth + Realtime + Storage) + N8N (OCR webhook) + Vercel (host + cron).
- **Domain:** B2B Spanish energy consultancy. Flow: invoice OCR → tariff comparison → proposal → signature → commission split.
- **Supabase project:** `proyectozinergia` (ref `gmjgkzaxmkaggsyczwcm`, region `eu-central-1`).
- **Roles (3 levels, enforced via RLS + `requireServerRole`/`requireRouteRole`):**
  - **Admin** (`zinergiaconsultora@gmail.com`) — full control, manages tariffs, configures per-franchise commission %.
  - **Franchise** — manages its network of collaborators, earns a **per-franchise-configurable** cut of collaborator commissions.
  - **Agent** (collaborator) — uploads invoices, manages own clients, sees own commissions only.

## Security non-negotiables

- `SUPABASE_SERVICE_ROLE_KEY` must only appear in `src/lib/supabase/service.ts`. Any other import is a bug.
- Every mutating server action must call `requireServerRole(...)` before any DB write.
- Sensitive PII (`CUPS`, `DNI`, direccion, nombre completo) is subject to an encryption/anonymization strategy — see `docs/rgpd.md` once it exists.
- No `console.log` of PII. No PII in error messages that reach the client.

## Git & PR conventions

- Branch naming: `claude/<topic>-<short-desc>` (e.g. `claude/baseline-migrations`, `claude/commission-tests`).
- Commit message format: `<type>: <short>` — `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- PRs stack: if a branch depends on another still-in-review branch, base it on that branch (not on `main`). Merge order must respect the stack.

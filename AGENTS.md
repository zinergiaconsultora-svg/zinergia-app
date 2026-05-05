# Zinergia — Project-specific rules for Codex

This file documents rules specific to the Zinergia codebase. Global rules live in `~/.Codex/rules/` and always apply on top of this file.

---

## 🔴 Database schema changes — MANDATORY workflow

> **As of 2026-04-20, ALL database schema changes must go through a migration file in `supabase/migrations/`.**
> **Manual edits on the Supabase dashboard are prohibited.**

### Why

Until now, schema drift was rampant: 5 migrations in git vs. a 1,500-line `database.types.ts` reflecting a much larger real schema. This made new environments unreproducible and rollbacks impossible.

The baseline `supabase/migrations/20260420000000_baseline.sql` captures the full production schema as of 2026-04-20 (24 tables, 58 RLS policies, 9 functions, 11 triggers, 41 indexes).

### The flow for ANY schema change

1. Write a new migration file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Supabase uses the numeric prefix as the migration version, so it must be unique.
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

### Supabase CLI workflow discovered in this repo

- Use `npx supabase ...`; the global `supabase` command may not exist on Windows.
- The repo is already initialized (`supabase/config.toml` exists). Do **not** run `supabase init --force` unless explicitly replacing config.
- Link the project with `npx supabase link --project-ref gmjgkzaxmkaggsyczwcm`.
- In non-interactive Codex shells, `npx supabase login` may fail. Use a local terminal login or set `SUPABASE_ACCESS_TOKEN` in the shell. Never paste Supabase tokens in chat; revoke any token that was exposed.
- In PowerShell, avoid `>` when regenerating types because a failed command can leave the file empty. Prefer:
  `npx supabase gen types typescript --project-id gmjgkzaxmkaggsyczwcm | Set-Content -LiteralPath 'src\types\database.types.ts' -Encoding utf8`
- If a migration was intentionally applied with `npx supabase db query --linked --file <migration.sql>`, only then mark it in remote history with `npx supabase migration repair --status applied <version>`.
- Migration history was reconciled on 2026-05-05: `npx supabase migration list` should show every local migration matched remotely, and `npx supabase db push` should report `Remote database is up to date.`

### SQL scripts outside migrations

- Historical root SQL files belong in `supabase/scripts/legacy/` with a README stating they are not migrations.
- New one-off data repair scripts belong under `supabase/scripts/` with a timestamped name and notes about target environment, operator, date, and rollback plan.
- The only schema source of truth is `supabase/migrations/`.

---

## Project context (summary for Codex)

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
- Sensitive PII (`CUPS`, `DNI`) is encrypted at the application layer via `src/lib/crypto/pii.ts` (AES-256-GCM ciphertext + HMAC-SHA-256 blind index). See `docs/rgpd-runbook.md` for key management, rotation, retention, and derecho al olvido. `direccion` and `nombre completo` are NOT currently encrypted — decision revisited if scope changes.
- OCR training examples must be sanitized with `src/lib/ocr/sanitizeTrainingData.ts` before storing, serving to N8N, or saving human corrections.
- Public proposal acceptance must keep rate limiting and signature payload validation; tokens alone are not enough for abuse protection.
- `/api/cron/*` routes must check `Authorization: Bearer CRON_SECRET` before service-role work.
- Keys: `APP_ENCRYPTION_KEY` (base64, 32 bytes) + `APP_ENCRYPTION_PEPPER` (hex, ≥16 bytes) are **required in production** (`src/lib/env.ts` enforces via `superRefine`). Generate with `node scripts/generate-encryption-keys.mjs`. Never commit. Never paste in chat.
- For queries that need equality on CUPS/DNI, use the `*_hash` column with `hashCups()` / `hashDni()`. Never query the ciphertext column — it is probabilistic.
- No `console.log` of PII. No PII in error messages that reach the client.

## Quality gates

Run these before handing off security/data changes:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test`
- `npm run build`

`npm run test:e2e` requires `PLAYWRIGHT_BASE_URL`, `E2E_AGENT_EMAIL`, `E2E_AGENT_PASSWORD`, `E2E_ADMIN_EMAIL`, and `E2E_ADMIN_PASSWORD`. If missing, mark E2E as skipped rather than inventing coverage.

## Git & PR conventions

- Branch naming: `Codex/<topic>-<short-desc>` (e.g. `Codex/baseline-migrations`, `Codex/commission-tests`).
- Commit message format: `<type>: <short>` — `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- PRs stack: if a branch depends on another still-in-review branch, base it on that branch (not on `main`). Merge order must respect the stack.

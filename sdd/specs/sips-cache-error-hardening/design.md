# SIPS Cache Error Hardening Design

Status: design approved on 2026-07-02.

## Summary

Keep the existing SIPS route and schema, but align TTL behavior with the product spec. The endpoint already authenticates users, rate limits requests, hashes CUPS, reads/writes cache through the service client, and audits queries. The change is intentionally narrow: use `expires_at > now()` for cache reads, set new expiry to 7 days, cap historical rows via migration, and sanitize client-facing error messages.

## Affected Files

- `src/app/api/sips/electricity/annual-consumption/route.ts`
- `src/app/api/sips/electricity/annual-consumption/__tests__/route.test.ts`
- `supabase/migrations/20260702124255_sips_cache_ttl_error_hardening.sql`
- `sdd/feature_list.json`
- `sdd/progress/history.md`

## Data Model

The migration updates only `public.sips_consumption_cache.expires_at`:

- default becomes `now() + interval '7 days'`
- existing rows with later expiries are capped to `fetched_at + interval '7 days'`

No new tables, columns, grants, or policies are required.

## Error Handling

The endpoint may retain the internal error message in `sips_query_audit.error_message` for operator diagnosis, but the HTTP response exposes only:

- `Servicio SIPS no configurado temporalmente` for missing CNMC credentials
- `No se pudo consultar SIPS en este momento` for upstream/runtime failures

## Verification

- Focused API route tests for cache hit, 7-day successful write, and sanitized config error.
- Existing SIPS parser and annual consumption fallback tests.
- SDD validation, typecheck, lint, tests, and build.

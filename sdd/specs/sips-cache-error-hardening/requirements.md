# SIPS Cache Error Hardening Requirements

Status: requirements approved on 2026-07-02.

## Intent

Cerrar el desajuste entre la spec CNMC/SIPS y la implementación actual: la cache debe respetar un TTL de 7 días y los errores públicos del endpoint no deben exponer detalles internos de configuración o proveedor.

## Requirements

- [REQ-001] WHEN SIPS annual consumption is cached, the cache row shall expire 7 days after `fetched_at`.
- [REQ-002] WHEN the SIPS endpoint reads cache, it shall consider `expires_at` as the source of truth for cache validity.
- [REQ-003] IF CNMC/SIPS credentials or upstream calls fail, THEN the client response shall use a sanitized Spanish error message without environment variable names or provider internals.
- [REQ-004] WHEN SIPS lookup fails, the server shall still audit the query using only the CUPS blind index and status.
- [REQ-005] WHEN the migration runs, existing cache rows with expiry beyond 7 days shall be capped to `fetched_at + 7 days`.

## Properties / Invariants

- [INV-001] Raw CUPS must not be persisted; only `cups_hash` is stored.
- [INV-002] The route remains authenticated and rate-limited.
- [INV-003] The service role remains server-only through `src/lib/supabase/service.ts`.

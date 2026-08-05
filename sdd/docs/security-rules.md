# Reglas de seguridad para specs

Estas reglas heredan y concretan `AGENTS.md`.

## Service role

- `SUPABASE_SERVICE_ROLE_KEY` solo puede aparecer en `src/lib/supabase/service.ts`.
- Las specs deben declarar cualquier uso de service role.
- El uso de service role debe estar justificado y limitado.

## Mutaciones

- Toda mutating server action debe llamar a `requireServerRole(...)` antes de escribir.
- Toda route handler de rol debe usar `requireRouteRole(...)`.
- Las rutas cron deben validar `Authorization: Bearer CRON_SECRET`.

## PII

- CUPS y DNI son sensibles.
- Usar cifrado de aplicacion via `src/lib/crypto/pii.ts`.
- Para busqueda de igualdad, usar hash/blind index: `hashCups()` / `hashDni()`.
- No consultar ciphertext probabilistico para igualdad.
- No poner PII en logs, errores cliente o fixtures no sanitizados.

## Public proposal surface

Toda spec que toque `/p/[token]` o aceptacion publica debe revisar:

- Token entropy and expiry/invalid states.
- Rate limiting.
- Signature payload validation.
- Replay/double-submit behavior.
- Error messages without PII.
- Audit trail.

## Supabase schema

- Cualquier schema change requiere migracion nueva en `supabase/migrations/`.
- Regenerar `src/types/database.types.ts`.
- Revisar RLS y policies para Admin, Franchise and Agent.


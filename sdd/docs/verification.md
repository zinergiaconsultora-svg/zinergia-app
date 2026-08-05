# Verificacion

## Gates base

Ejecutar segun riesgo:

```powershell
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

## E2E

`npm run test:e2e` requiere:

- `PLAYWRIGHT_BASE_URL`
- `E2E_AGENT_EMAIL`
- `E2E_AGENT_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

Si faltan, marcar E2E como omitido y explicar el motivo.

## Verificacion por riesgo

- Schema/RLS: migracion, tipos regenerados, tests de permisos si existen.
- PII: revisar logs, errores cliente, hashing/cifrado y fixtures.
- Public surface: rate limiting, token validation, payload validation and manual abuse checks.
- Business calculation: tests unitarios con casos limite y valores esperados.
- External integration: mocks, failure path and retry/idempotency behavior.


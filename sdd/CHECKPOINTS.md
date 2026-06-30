# Definition of Done reforzada

Una feature SDD de Zinergia solo esta terminada cuando todos los puntos aplicables estan resueltos.

## Producto y requisitos

- [ ] Todos los requisitos `REQ-*` estan implementados.
- [ ] Cada requisito tiene al menos un test o una justificacion explicita de verificacion manual.
- [ ] La experiencia queda validada para los roles afectados: Admin, Franchise, Agent o cliente publico.
- [ ] Los casos de error principales muestran mensajes utiles sin filtrar PII.

## Seguridad y datos

- [ ] Ningun cambio de schema existe sin migracion en `supabase/migrations/`.
- [ ] Si hay migracion, `src/types/database.types.ts` se regenera junto al cambio.
- [ ] Las mutating server actions llaman a `requireServerRole(...)` antes de escribir.
- [ ] Las route handlers protegidas llaman a `requireRouteRole(...)` o validan su secreto segun corresponda.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo aparece en `src/lib/supabase/service.ts`.
- [ ] CUPS/DNI usan cifrado y blind index (`hashCups()` / `hashDni()`) cuando aplica.
- [ ] No hay PII en `console.log`, errores cliente o trazas innecesarias.
- [ ] Las rutas `/api/cron/*` validan `Authorization: Bearer CRON_SECRET`.
- [ ] Las superficies publicas mantienen rate limiting, tokens y validacion fuerte de payload.

## Verificacion

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build` para cambios de seguridad, datos o flujo critico.
- [ ] `npm run test:e2e` si existen credenciales E2E; si no, se marca como omitido con motivo.

## Cierre

- [ ] `sdd/specs/<feature>/tasks.md` esta completo.
- [ ] La feature cambia a `done` en `sdd/feature_list.json`.
- [ ] El resultado queda registrado en `sdd/progress/history.md`.
- [ ] Se documentan riesgos residuales, follow-ups y verificaciones no ejecutadas.

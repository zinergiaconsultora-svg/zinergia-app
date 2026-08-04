# ZIN-SDD-043 · Slice 1 implementado — autorización antes de caché y CNMC

**Autor:** Claude (Opus 5) · **Fecha:** 2026-08-04
**Cubre:** REQ-001, REQ-002, REQ-003 (parcial), REQ-004, REQ-005, REQ-007, REQ-008, REQ-010, REQ-012
**No cubre:** REQ-006 (UI de captura/revocación de consentimiento), REQ-009 (ya existía), REQ-011 (UI)

---

## El hueco, confirmado en código

`src/app/api/sips/electricity/annual-consumption/route.ts` (antes de este cambio):

1. Rate limit
2. `auth.getUser()` — **cualquier usuario autenticado**
3. Validación de formato del CUPS
4. **Cliente service-role → lectura de caché → respuesta con el consumo**
5. Si no hay caché → CNMC → respuesta

En todo el fichero no aparecía `sips_consents`, ni `requireServerRole`, ni `owner_id`, ni consulta alguna a `clients`.

**Impacto:** cualquier agente de cualquier franquicia podía enviar cualquier CUPS español válido y recibir el consumo anual de ese punto de suministro — datos personales de un titular ajeno, sin consentimiento y sin ámbito. La `sips_query_audit` lo registraba correctamente, de modo que existía el registro de la fuga, no su prevención.

La regla del `CLAUDE.md` (*"toda server action mutante debe llamar a `requireServerRole`"*) no lo cubría porque **esto es una lectura**. Vale la pena extender esa regla.

**Atenuante relevante:** ningún componente de `src/` ni de `e2e/` invoca esta ruta. Estaba expuesta pero sin consumidor en la aplicación, así que endurecerla **no rompe ningún flujo existente**. El corte operativo que temíamos es cero.

---

## Qué se ha construido

### 1. La decisión vive en la base de datos

`supabase/migrations/20260804030000_authorize_sips_consumption.sql`

`public.authorize_sips_consumption(p_cups_hash text) RETURNS jsonb` — `SECURITY DEFINER`, `STABLE`, `search_path = ''`, devuelve **solo** `{allowed, reason}`.

Tres motivos para ponerla en SQL y no en TypeScript:

1. La ruta la invoca con el **cliente del usuario**, así que no se crea ningún cliente service-role antes de autorizar (REQ-001).
2. La RLS de `sips_consents` es `user_id = auth.uid()`, que no puede expresar la supervisión de franquicia ni de admin. Ampliar esa política concedería visibilidad de filas; una función booleana responde la pregunta sin exponerlas.
3. Una sola definición de la regla, así que el camino de caché y el camino en vivo **no pueden divergir** (INV-002).

Regla: existe un consentimiento **no revocado** para ese `cups_hash`, y además

- está atado a un cliente que cae dentro del ámbito del actor (admin: todos · franquicia: su `franchise_id` · agente: sus `owner_id`), **o**
- no está atado a cliente y **lo capturó el propio actor** — el caso de prospección.

El consentimiento se exige **también a admin**: la supervisión no sustituye a la autorización del titular (INV-004).

> Nota deliberada: aquí `role = 'admin'` no se endurece a la tupla canónica de autoridad. Esta función responde una pregunta de consentimiento, no de autoridad; denegar a un admin operativo por un defecto de tupla ajeno sería una regresión.

### 2. Auditoría sin texto libre de terceros

La ruta anterior guardaba **el mensaje de error del CNMC tal cual** en `error_message`, metiendo texto libre de un tercero en la traza (viola REQ-007). Ahora:

- `status` admite `'denied'` — antes el CHECK solo tenía `success | cache_hit | error`, así que **las denegaciones ni siquiera podían registrarse**.
- Columna nueva `reason_code` con CHECK sobre una taxonomía cerrada de 9 códigos seguros.
- `error_message` queda como deprecada, sin escrituras nuevas.

### 3. Autorización y kill switch en la aplicación

`src/lib/sips/authorization.ts`

- `authorizeSipsConsumption()` — **falla cerrado** ante error, excepción o payload inesperado. Solo un `allowed === true` literal autoriza; `'true'`, `1` o un campo ausente deniegan.
- Códigos de razón desconocidos se degradan a `authorization_unavailable` en lugar de creerse.
- `isLiveSipsAccessEnabled()` — interruptor `SIPS_LIVE_ACCESS_ENABLED`. Deniega **sin consultar la base de datos**, y no relaja ninguna regla, así que volver a activarlo no puede reabrir una lectura no autorizada (REQ-012).

  **Por defecto está en `false`.** Decisión de producto del 2026-08-04: la integración no tiene credenciales CNMC configuradas en ningún fichero de entorno del repositorio y ninguna pantalla la invoca, así que lo honesto es que esté apagada. Encenderla es un acto deliberado que va junto con aprovisionar las variables `CNMC_OAUTH_*`.

  El mismo interruptor **oculta la UI de captura de consentimiento**: con SIPS apagado, `getSipsConsentStatusAction` devuelve `sipsEnabled: false` sin consultar nada y `SipsConsentControl` no renderiza. Pedirle a un comercial que registre una autorización para una consulta que no puede ejecutar es ruido, no cumplimiento.

### 4. La ruta

- Autoriza **antes** de crear el cliente service-role, leer caché o llamar al CNMC.
- **Un único mensaje 403** para toda denegación. Si distinguiera "CUPS desconocido" de "no es tuyo" de "consentimiento revocado", la propia denegación sería un oráculo sobre suministros ajenos.
- Errores del CNMC mapeados a `upstream_unavailable` / `upstream_failed` antes de tocar auditoría o respuesta.
- Las denegaciones se auditan; un fallo de auditoría nunca convierte una denegación en éxito.

---

## Verificación

| Gate | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 |
| `npm test` | ✅ **124 ficheros, 809 tests** (antes 122 / 788) |

**21 tests nuevos.** El que da nombre al slice:

```
it('reads no cache and calls no CNMC when authorization is denied')
```

usa un espía que registra cada tabla tocada, y comprueba que tras una denegación no aparece `sips_consumption_cache` ni se llamó al CNMC. Otros cubren: orden autorización→service-client, mensaje 403 idéntico para cuatro razones distintas, ausencia de CUPS crudo en la auditoría, y que el mensaje del CNMC con un token dentro no llega ni a la traza ni al cliente.

---

## Orden de despliegue — importa

**La migración va primero.** Si la ruta se despliega sin ella, el RPC no existe → `authorization_unavailable` → **deniega todo**. Es el fallo correcto (cerrado) y no rompe nada porque no hay consumidor, pero conviene saberlo en lugar de descubrirlo.

Igualmente, hasta aplicar la migración la escritura de `reason_code` falla en silencio (supabase-js devuelve `error`, no lanza), así que la auditoría queda incompleta pero la autorización no se ve afectada.

---

---

# Slice 2 — captura y revocación de consentimiento (REQ-006, REQ-011)

Slice 1 dejó la lectura exigiendo consentimiento, pero **nada podía crear uno**, así que la ruta denegaba siempre. Este slice añade el camino de escritura y, de paso, cierra la puerta del navegador.

## Un hallazgo del propio slice

`sips_consents` tenía una política `FOR ALL TO authenticated USING (user_id = auth.uid())` más privilegios de tabla. Es decir: **un navegador con la anon key podía insertar un consentimiento para cualquier CUPS, con cualquier origen y cualquier fecha, y además editar o borrar su propio historial.**

Eso vacía de sentido el registro. La evidencia de un consentimiento solo vale algo si **no se puede escribir ni reescribir desde el cliente** (REQ-006, INV-007, INV-010). Ahora `authenticated` conserva `SELECT` de sus propias filas y ha perdido `INSERT/UPDATE/DELETE`; toda escritura pasa por los comandos.

## Qué se ha construido

`supabase/migrations/20260804040000_sips_consent_capture.sql`

- `private.can_reach_sips_client(profile, client_id)` — predicado de ámbito **compartido**, para que captura, revocación y la puerta de lectura no puedan divergir.
- `record_sips_consent(...)` — **idempotente** por (suministro, cliente, actor capturador): un doble clic devuelve el consentimiento original en vez de apilar filas. Origen restringido a 4 valores, notas acotadas a 500 caracteres. Todo fallo de autorización lanza **el mismo error opaco**, para que nadie pueda sondear qué `client_id` existen.
- `revoke_sips_consent(...)` — idempotente y de un solo sentido. Re-autorizar crea una fila nueva; el historial no se edita.
- `get_sips_consent_status(...)` — estado para la UI, sin datos de consumo.

`src/app/actions/sipsConsent.ts` — hashea el CUPS en el servidor (el crudo nunca llega a la base de datos), devuelve resultado discriminado en vez de lanzar, y trata cualquier cosa que no sea un `true` literal como "sin consentimiento".

`src/features/crm/components/SipsConsentControl.tsx` — dentro de la tarjeta del punto de suministro, **solo para electricidad** (el SIPS de gas queda fuera de alcance de la spec). Sin entrada de menú nueva; el CUPS y el cliente ya están en contexto y no se reescriben. El efecto lleva guarda de cancelación para que una respuesta lenta de un suministro anterior no pinte el estado equivocado sobre otro CUPS.

## Verificación acumulada

| Gate | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 |
| `npm test` | ✅ **125 ficheros, 826 tests** |

**No verificado:** la interfaz no se ha comprobado en navegador. Requiere sesión autenticada contra un proyecto Supabase con estas migraciones aplicadas; sin ellas el RPC no existe y el control muestra siempre el estado ámbar. Queda pendiente de verificación visual y de accesibilidad a 390 px (REQ-011).

---

## Qué falta para cerrar ZIN-SDD-043

1. **REQ-003 completo** — pruebas positivas y negativas autenticadas para los tres roles contra base de datos real; aquí están cubiertas a nivel de contrato de la función.
2. **REQ-012, informe previo** — contar suministros con y sin consentimiento antes del despliegue, sin CUPS en claro.
3. **Verificación visual** de la captura (desktop y 390 px).
4. **Inputs legales pendientes** (de la propia spec): redacción del consentimiento, estándar de prueba, retención y caducidad. Afectan al *texto* y a la *vigencia*, no al mecanismo ya construido.

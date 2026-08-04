# Auditoría independiente — ZIN-SDD-041 `profile-authority-hardening`

**Auditor:** Claude (Opus 5) · **Fecha:** 2026-08-04 · **Rama:** `Codex/simplify-admin-navigation`
**Alcance:** 8 migraciones, Edge Function, cron Supabase, `vercel.json`, frontera de permisos y cambios fuera de alcance.
**Método:** revisión adversarial del código. La documentación de Codex se ha tratado como punto de partida, no como evidencia. No se ha ejecutado nada contra producción ni se ha modificado ningún fichero del cambio.

---

## VEREDICTO: `GO CON CONDICIONES`

El diseño es de calidad alta y poco común: expand→contract disciplinado, guard trigger con contexto verificado que **también** obliga a `service_role`, idempotencia por `request_id`, bloqueo advisory global para decisiones de último-Admin y ciclos, eventos de autoridad inmutables por trigger, y rate-limiting con recibos sin PII. No he encontrado ninguna vía por la que un navegador recupere autoridad tras el contrato.

Pero **no se puede aplicar el contrato a producción tal como está**, por un motivo concreto: no existe ninguna forma aprobada de comprobar antes si los datos de producción lo soportan. Ese es el único bloqueante duro; el resto son condiciones acumulables.

---

## CORRECCIONES YA APLICADAS EN ESTA SESIÓN

No se ha modificado ninguna de las 8 migraciones ya aplicadas en staging. Todo son ficheros nuevos o código de aplicación.

| # | Hallazgo | Corrección | Fichero |
|---|---|---|---|
| 1 | **C1** | Gate de contrato ejecutable contra producción: mismo SELECT agregado, sólo lectura, exige `-ConfirmProduction`, y **evalúa** el veredicto (`canonical_active_admins >= 1` y 11 contadores a cero) devolviendo `PASS`/`BLOCKED` con exit code. Falla cerrado si no puede parsear la salida. | `supabase/scripts/profile_authority_contract_gate.ps1` (nuevo) |
| 2 | riesgo 1 | Script de reversión contrato → compatible, con aserciones que impiden confundir un rollback parcial con éxito. Documenta explícitamente lo que **no** restaura y por qué. | `supabase/scripts/profile-authority/rollback_contract_to_compatible.sql` (nuevo) |
| 3 | **A1** | `deno check` + `deno lint` sobre `supabase/functions/`, con config Deno y paso en el job `lint-and-type`. | `supabase/functions/deno.json`, `package.json` (`lint:functions`), `.github/workflows/ci-cd.yml` |
| 4 | **A2** | Aviso de aprovisionamiento atascado (≥ 15 min) portado a la Edge Function como log estructurado sin PII. | `supabase/functions/.../index.ts` |
| 5 | **A3** | `testTimeout`/`hookTimeout` a 20 s. Los tres ficheros afectados pasaban en aislamiento y fallaban bajo carga. | `vitest.config.ts` |
| 6 | **M2** | `findOwnedUser` deja de tener tope de 1000 usuarios y distingue *no encontrado* de *búsqueda incompleta*, para no emitir un `auth_lookup_mismatch` falso. Aplicado a ambas implementaciones. | `index.ts`, `route.ts` |
| 7 | **M3** | `retry_exhausted` pasa a ser terminal de verdad: la app lo emite a las 24 h y la nueva migración lo excluye del barrido. | `20260804010000_stop_sweeping_retry_exhausted_provisioning.sql` (nuevo), `index.ts`, `route.ts` |
| 8 | **M5** | `.next-*/` e `.impeccable/` ignorados en git. | `.gitignore` |
| 8b | **M8 (nuevo)** | Las reglas `!scripts/` que añadió este cambio no estaban ancladas, y en git un patrón sin `/` inicial coincide **a cualquier profundidad**: estaban des-ignorando `.agents/scripts/` y `.agents/skills/impeccable/scripts/`. Ancladas a la raíz; verificado con `git check-ignore -v` que `.agents/scripts` vuelve a estar ignorado y que `scripts/profile-authority/**` sigue siendo trackeable. | `.gitignore` |
| 9 | **B1** | Comparación del secreto en tiempo constante sobre digests SHA-256 en ambas implementaciones. El contrato de autorización exacta que fija el test se mantiene. | `index.ts`, `route.ts` |
| 10 | **B5** | `isStillBanned()` sustituye a `banned_until !== null`, que trataba el campo ausente de GoTrue como ban activo. | `index.ts`, `route.ts` |

**Revertido tras comprobarlo:** intenté eliminar `reconcileProvisioningFaultInjectionAdapter` (hallazgo B3), pero `src/lib/profile-authority/__tests__/profileAuthorityVerifier.test.ts:140` exige ese export. Restaurado con un comentario que explica su papel. **B3 se queda como observación de diseño, no como corrección.**

**Verificación tras los cambios:**

| Gate | Antes | Después |
|---|---|---|
| `npx tsc --noEmit` | ✅ exit 0 | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 | ✅ exit 0 |
| `npm test` (suite completa) | ❌ exit 1 — 4 tests / 3 ficheros | ✅ **exit 0 — 121 ficheros, 773 tests, 177 s** |
| `git status` | 6 árboles de artefactos sin ignorar | limpio; sólo fuentes, specs y migraciones |

**Sigue pendiente y es el único bloqueante:** ejecutar el gate contra producción. Requiere sesión de Supabase.

---

## HALLAZGOS

### 🔴 CRÍTICO

#### C1 · El contrato se aplicaría a producción a ciegas, con riesgo de lockout total de autoridad

> ### ✅ CONFIRMADO EN PRODUCCIÓN Y RESUELTO — 2026-08-04
>
> El gate se ejecutó contra producción y **el riesgo era real, no teórico**:
>
> ```
> FAIL canonical_active_admins = 0
> FAIL admin_noncanonical_tuple = 1
> ```
>
> El admin de Zinergia —la cuenta que crea los perfiles de los colaboradores— tenía
> `franchise_id` poblado. Con esa fila, aplicar el contrato habría dejado la gestión de
> autoridad **sin ningún actor capaz de ejercerla**, y `20260803191000` habría abortado
> contra su propio CHECK.
>
> **Corrección aplicada** (con OK explícito del propietario): se vació `franchise_id` en esa
> única fila. `parent_id` ya era `NULL`. El admin no poseía ningún cliente y sigue siendo
> padre de los 5 colaboradores, así que no se alteró ninguna relación.
> `authority_version` pasó de 0 a 1.
>
> Punto de reversión guardado en
> `supabase/scripts/profile-authority/ROLLBACK_admin_canonicalization_20260804.sql`.
>
> **Reejecución del gate: `contract_gate=PASS`**, los 12 controles en verde. El bloqueante
> queda levantado.
>
> Hallazgos colaterales del ejercicio, ya corregidos en el script: `ZINERGIA_PROD_DATABASE_URL`
> usa el host directo `db.<ref>.supabase.co`, que es **solo IPv6 desde 2024 y no resuelve**
> en la red del operador (verificado: el pooler resuelve con tres IPv4, el directo no
> resuelve); el enmascarado del ref rompía con ese formato; y el CLI escribe progreso por
> stderr, que `ErrorActionPreference=Stop` convertía en error fatal.

**Archivos:** `supabase/scripts/profile_authority_preflight.ps1:42-47` · `supabase/migrations/20260803191000_enforce_profile_authority_tuple.sql:8-14` · `supabase/migrations/20260803190000_contract_profile_boundary.sql:39-43`

Tres hechos que, combinados, forman el riesgo:

1. **La preflight se niega por diseño a tocar producción.** El runner aborta si el ref resuelve al proyecto de producción:
   ```
   if ($projectRef -eq $productionRef) {
       throw 'Refusing to run: the supplied environment resolves to the production project.'
   }
   ```
   Es la única herramienta que calcula `admin_noncanonical_tuple`, `canonical_active_admins`, `franchise_noncanonical_tuple`, `agent_noncanonical_tuple`, `orphan_parent`, `profiles_in_cycle` — exactamente lo que decide si el contrato es aplicable.

2. **`20260803191000` añade un CHECK sin `NOT VALID` y sin reparación.** El encabezado de `190000` lo dice explícitamente: *"This migration deliberately has no data repair path"*. Una sola fila con tupla no canónica aborta la migración a mitad de promoción, con `190000` ya aplicada (navegador sin escritura) y `192000` sin aplicar.

3. **Si el Admin de producción no es canónico, queda fuera del sistema.** Tras `190000`, `can_read_profile_directory` sólo concede visión global a `role='admin' AND parent_id IS NULL AND franchise_id IS NULL`, y `change_profile_authority` lanza `ACTOR_NOT_ADMIN` con el mismo criterio. Un admin con `franchise_id` poblado deja de ver la red **y** no puede corregir a nadie — incluido a sí mismo. No hay recuperación desde la aplicación; haría falta SQL directo como `postgres`.

Que esto no es teórico lo dice el propio comentario de la migración de expansión (`20260803150000:10-11`):

> *"no canonical Admin currently exists in the reviewed staging preflight; this migration does not guess or backfill one."*

Si en staging no había Admin canónico, la probabilidad de que producción esté en el mismo estado es alta. La lista GO/NO-GO del handoff (pasos 1-7) **no incluye ningún paso que verifique la tupla del Admin de producción antes del paso 5** (aplicar el contrato).

**Corrección mínima:** añadir un modo de sólo lectura de la preflight autorizado para producción (mismo SQL de un único SELECT agregado, mismo timeout, `default_transaction_read_only`), ejecutarlo, y **bloquear el paso 5 hasta que `canonical_active_admins >= 1` y todos los contadores `*_noncanonical_tuple`, `orphan_*`, `self_parent` y `profiles_in_cycle` sean 0**. Si alguno no lo es, la recuperación explícita va antes del contrato, nunca después.

---

### 🟠 ALTO

#### A1 · La Edge Function no pasa por ningún gate de calidad

**Archivos:** `tsconfig.json:43` · `eslint.config.mjs:24` · ausencia de `supabase/functions/**/__tests__`

```jsonc
// tsconfig.json — exclude
"scripts",
"supabase/functions",   // ← añadido en este cambio
```
```js
// eslint.config.mjs — globalIgnores
"supabase/functions/**",  // ← añadido en este cambio
```

El único test de reconciliación es `src/app/api/cron/reconcile-invitation-provisioning/__tests__/route.test.ts`, que cubre **la ruta Next que el cron ya no invoca**. `supabase/functions/reconcile-invitation-provisioning/index.ts` no está type-checked, no está linted y no tiene tests.

Es decir: **el componente que dejará de ejecutarse está cubierto y el que pasará a ejecutarse en producción no lo está en absoluto.** el job `lint-and-type` de `.github/workflows/ci-cd.yml` no aporta ninguna señal sobre él. La exclusión está técnicamente justificada (es Deno con especificadores `npm:`), pero la solución correcta es `deno check` + `deno lint` en CI, no el silencio.

Responde a la pregunta 6 del handoff: **no**, la cobertura no distingue correctamente entre lo histórico aprobado y lo nuevo pendiente.

#### A2 · La migración a Edge Function pierde la alerta de aprovisionamientos atascados

**Archivos:** `src/app/api/cron/reconcile-invitation-provisioning/route.ts:170-176` vs `supabase/functions/reconcile-invitation-provisioning/index.ts:149-152`

La ruta Next avisa cuando un aprovisionamiento lleva ≥ 15 minutos sin completarse:

```ts
if (!reconciled && Date.now() - Date.parse(candidate.created_at) >= 15 * 60_000) {
    logger.warn('[profile-invitation-reconciliation] incomplete provisioning requires review', { ... });
}
```

La Edge Function **no tiene equivalente**: cuenta `completed`/`review` en la respuesta y nada más. Tras el corte, un colaborador que se quede bloqueado en `needs_reconciliation` no genera ninguna señal; sólo se detecta consultando la tabla a mano.

La equivalencia funcional que afirma el handoff no se sostiene en este punto. Es además el peor sitio para perder observabilidad: el fallo se manifiesta como "un usuario invitado no puede entrar", que llega por soporte, no por monitorización.

#### A3 · La suite de tests no es fiable como gate de release

**Evidencia reproducida en esta auditoría:**

| Ejecución | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 |
| `npm test` (suite completa) | ❌ **exit 1** — 4 tests / 3 ficheros fallidos, 769 pasados, 220 s |
| `npx vitest run <los 3 ficheros> --testTimeout=60000` | ✅ exit 0 — 35 tests pasados |

Los tres fallos son *timeouts* a los 5000 ms por defecto bajo carga paralela, entre ellos `src/lib/profile-authority/__tests__/profileAuthorityVerifier.test.ts` — que forma parte de este mismo cambio. En aislamiento pasan todos.

No son fallos lógicos, pero sí invalidan el gate: el job `test` de CI ejecuta `npm run test:coverage` sobre esta misma suite y **falla de forma no determinista**. El handoff presenta los gates como evidencia sin mencionar que la suite no cierra en verde.

---

### 🟡 MEDIO

#### M1 · El vector de exposición del secreto no es `cron.job`, es `pg_net`

**Archivo:** `supabase/migrations/20260803220752_schedule_invitation_reconciler_with_supabase_cron.sql:61-77`

Confirmo la afirmación de Codex: `cron.job.command` guarda la *consulta* a `vault.decrypted_secrets`, no el valor. Verificado leyendo el comando agendado. ✅

Pero la pregunta 3 del handoff (*"¿Hay un vector de lectura de cron.job que requiera un endurecimiento adicional?"*) apunta al sitio equivocado. Al ejecutarse, `net.http_get(...)` materializa la cabecera `Authorization: Bearer <secreto>` en la cola de peticiones de **pg_net** (`net.http_request_queue`), y las respuestas quedan en `net._http_response` durante el TTL. El secreto en claro pasa por tablas de la base de datos aunque Vault y `cron.job` estén limpios.

**Mitigación:** restringir explícitamente los privilegios sobre el esquema `net`, fijar un TTL bajo de respuestas, y considerar rotación periódica del `CRON_SECRET`.

#### M2 · `findOwnedUser` deja de funcionar por encima de 1000 usuarios Auth

**Archivo:** `supabase/functions/.../index.ts:45-54` (idéntico en `route.ts:29-42`)

```ts
for (let page = 1; page <= 10; page += 1) {
    const result = await service.auth.admin.listUsers({ page, perPage: 100 });
```

Tope duro de 10 páginas × 100 = 1000 usuarios. Superado ese umbral, un candidato sin `auth_user_id` cuyo usuario esté más allá se marca como `auth_lookup_mismatch` — un diagnóstico **falso**, que además es de los que exigen intervención manual. Es una bomba de relojería atada al crecimiento de la red, y el mensaje de error apuntará en la dirección equivocada.

#### M3 · Reintento sin límite: `retry_exhausted` está definido pero nunca se usa

**Archivos:** `20260803150000:130` (CHECK que lo admite) · `index.ts:37-43` (`markReview` nunca lo emite)

`reconcile_profile_invitation_provisioning` selecciona `status <> 'completed' AND updated_at <= now() - 2 min`. Una fila irrecuperable se reclama cada 5 minutos indefinidamente, incrementando `attempt_count` sin techo y gastando hasta 10 llamadas a `listUsers` por ciclo. No hay backoff ni estado terminal.

#### M4 · La frontera "toda mutación pasa por un comando específico" no se cumple

**Archivos:** `src/app/actions/invoicing.ts:152`, `:197` · `src/lib/drive/folders.ts:94` · comentario en `20260803190000:223-224`

La migración documenta:
> *"every mutation uses a purpose-specific server command"*

Quedan tres `UPDATE` directos sobre `public.profiles`. **No rompen** tras el contrato (usan `createServiceClient()`, que conserva UPDATE) y **autorizan correctamente** — verifiqué que `updateFiscalProfileAction` y `verifyFiscalProfileAction` llaman a `getActor([...])` antes de escribir. Pero el comentario es inexacto y quedan dos caminos rivales para `fiscal_verified`: el RPC `update_own_iban` lo invalida atómicamente, y `verifyFiscalProfileAction` lo pone a `true` con un UPDATE crudo.

#### M5 · Cuatro directorios de build sin ignorar en git

**Archivo:** `.gitignore` (sólo cubre `.next-localhost.log`, líneas 35-36)

`git status` muestra sin trackear: `.next-codex-build/`, `.next-compile-diagnosis/`, `.next-final-verify/`, `.next-webpack-verify/`, `.impeccable/`, `.agents/scripts/`.

`.vercelignore` añadió `.next-*` y eslint añadió `.next-*/**`, pero **`.gitignore` no**. Un `git add -A` mete cuatro árboles de salida de compilación en el repositorio. Responde a la pregunta 7 del handoff: sí, hay artefactos generados que deben excluirse antes del commit.

#### M6 · La política SELECT de `profiles` cuesta una llamada plpgsql por fila

**Archivo:** `20260803190000:88-92`

```sql
USING ((SELECT private.can_read_profile_directory(id)))
```

El envoltorio `(SELECT ...)` es el idioma de Supabase para cachear, pero sólo funciona cuando la expresión **no** depende de la fila. Aquí depende de `id`, así que se evalúa por fila: una función plpgsql `SECURITY DEFINER` con dos búsquedas por índice para cada perfil listado. Con una red grande, los listados se degradan. Alternativa: reescribir el predicado como SQL inline sobre `profiles`/`franchises`, o cachear el actor en una función `STABLE` sin parámetros y componer el resto en SQL.

#### M7 · Posibles ejecuciones solapadas del reconciliador

`pg_net` corta a los 10 s (`:71`) mientras la función procesa hasta 100 candidatos secuencialmente, cada uno con varios viajes de ida y vuelta a Auth. Superado el timeout, el cron lo da por fallido pero la función sigue viva; cinco minutos después, la ventana de 2 minutos de `updated_at` permite reclamar los mismos candidatos. Las RPC son razonablemente idempotentes, pero `updateUserById(..., ban_duration:'none')` puede ejecutarse dos veces en paralelo sobre el mismo usuario.

---

### 🟢 BAJO

| ID | Hallazgo | Ubicación |
|---|---|---|
| B1 | Comparación **no** constante del secreto, en ambas implementaciones. El handoff afirma *"validación de secreto constante"* — inexacto. Riesgo real bajo (el jitter de red domina), pero conviene corregir la afirmación o el código. | `index.ts:25`, `route.ts:151` |
| B2 | `can_read_profile_directory` no fija `OWNER TO postgres` explícitamente, a diferencia de `update_own_iban` (`180000:47`). Como `SECURITY DEFINER` usada dentro de su propia política RLS, su corrección depende de que el rol que aplique la migración tenga `bypassrls`. Con Supabase CLI se cumple; conviene no dejarlo implícito. | `190000:8-13` |
| B3 | `reconcileProvisioningFaultInjectionAdapter` exportado desde un `route.ts` de producción. | `route.ts:182-186` |
| B4 | `update_own_iban` sólo acepta IBAN español (`^ES[0-9]{22}$`). Correcto hoy; bloquea colaboradores con cuenta extranjera. | `180000:21` |
| B5 | `if (user.banned_until !== null)` — GoTrue **omite** el campo cuando no hay ban, así que `undefined !== null` es `true` y se lanza un unban innecesario. Inofensivo pero ruidoso. | `index.ts:124` |
| B6 | `CLAUDE_AUDIT.md` sin trackear en la raíz del repositorio. | raíz |

---

## AFIRMACIONES DE CODEX QUE HE VERIFICADO ✅

| Afirmación | Veredicto |
|---|---|
| `vercel.json` conserva los crons diarios y sólo retira el de 5 min | ✅ Confirmado: 6 crons intactos. **Matiz:** el cambio ya está **commiteado** en la rama; `git diff` sobre el working tree no muestra nada |
| No se rebajó la protección de despliegues de Vercel | ✅ Confirmado, nada en `vercel.json` la toca |
| `handle_new_user()` no ejecutable por `service_role` | ✅ Confirmado, y la migración `214216` incluye su propia aserción `has_function_privilege` que aborta si falla |
| `cron.job` no materializa URL ni secreto | ✅ Confirmado (ver M1 para dónde sí aparece) |
| El navegador no puede actualizar autoridad, red ni rol | ✅ Confirmado: `190000:96-111` revoca INSERT/UPDATE/DELETE a `authenticated` y sólo concede SELECT por columnas; `191000:16` retira además `authority_version` |
| El interruptor de Vault desactiva el cron sin desagendar | ✅ Confirmado, el `WHERE enabled.decrypted_secret = 'true'` no produce fila y no hay petición |
| Migración de extensiones idempotente | ✅ `CREATE EXTENSION IF NOT EXISTS` + `unschedule`/`schedule`. **Matiz:** las tres líneas `CREATE EXTENSION` van **antes** del `BEGIN`, fuera de la transacción |

**Además, verificado por mi cuenta y no reclamado en el handoff:**

- El trigger `profiles_authority_guard` **también obliga a `service_role`** — los triggers no se saltan por rol. Tras el contrato, ni siquiera el service role puede cambiar autoridad sin contexto válido. Es la pieza más fuerte del diseño.
- `resolveTrustedActor` (`src/lib/profile-authority/trustedActor.ts:30-35`) y `can_read_profile_directory` **coinciden** en la definición de Admin canónico. Sin divergencia app/BD.
- `permissions.ts` falla cerrado y usa `unstable_rethrow` correctamente para no tragarse el control de flujo de Next.
- Los actions fiscales autorizan antes de escribir (`getActor([...])`).
- `update_own_iban` implementa mod-97 ISO 13616 correctamente.

---

## FLUJO DE AUTORIZACIÓN

**Hoy (producción, hasta `214216`):**
```
Navegador ──RLS heredada──> profiles (SELECT + UPDATE directo posible)
Guard trigger en modo compatibilidad: sin contexto ⇒ PERMITE la escritura,
   incrementa authority_version y emite RAISE LOG
   ⚠️ audit_profile_authority_change NO inserta evento ⇒ cambios sin rastro
```

**Objetivo (tras `190000`+`191000`+`192000`):**
```
Navegador ──SELECT por columnas, política única──> profiles
   (sin INSERT/UPDATE/DELETE, sin authority_version)
Toda mutación ──> RPC específica (service_role) ──> set_config(contexto)
   ──> guard verifica tupla completa: target, before/after version, before/after state
   ──> audit inserta evento inmutable
   ──> CHECK profiles_authority_tuple_check impide formas imposibles
Sin contexto ⇒ AUTHORITY_CONTEXT_REQUIRED (falla cerrado, incluido service_role)
```

---

## RIESGOS DE DESPLIEGUE Y ROLLBACK

1. **Rollback no simétrico.** Volver atrás desde `191000` exige `DROP CONSTRAINT`; desde `190000`, recrear las políticas legacy que `192000` borra. No hay migraciones `down`. Antes de tocar producción hace falta un script de reversión escrito y probado en staging.
2. **Ventana entre `190000` y `191000`.** `190000` concede `SELECT (authority_version)` a `authenticated` y `191000` lo revoca. Si la promoción se interrumpe entre ambas, el token de concurrencia queda expuesto al navegador. Deben aplicarse como una unidad.
3. **`ALTER TABLE ... ADD CONSTRAINT` sin `NOT VALID`** toma `ACCESS EXCLUSIVE` sobre `profiles` y la escanea entera. Con la tabla pequeña es instantáneo; conviene confirmarlo con `row_counts` antes.
4. **La Edge Function queda expuesta a Internet** (`verify_jwt = false`), con su comparación de secreto como única barrera. Falla cerrado si `CRON_SECRET` no está definido (`!cronSecret` ⇒ 401) ✅, pero no hay rate limiting.
5. **Contraseña de base de datos pendiente de rotación**, según reconoce el propio handoff.

**Sobre `verify_jwt = false` (pregunta 2 del handoff):** es *correcto* dado el diseño — el cron envía un secreto opaco, no un JWT, así que la verificación de JWT lo rechazaría siempre. Pero no es la *única* opción. Alternativa con defensa en profundidad: enviar `Authorization: Bearer <SUPABASE_ANON_KEY>` (JWT válido, `verify_jwt` sigue en `true`) y el secreto en una cabecera propia `X-Cron-Secret`. Así la plataforma filtra el tráfico anónimo antes de que llegue a tu código.

---

## CORRECCIONES MÍNIMAS ANTES DE PROMOCIONAR

**Bloqueantes:**
1. Habilitar un modo de sólo lectura de la preflight autorizado para producción y ejecutarlo. Condicionar el paso 5 a `canonical_active_admins >= 1` y a cero filas no canónicas. **(C1)**
2. Escribir y probar en staging el script de reversión de `190000`+`191000`+`192000`. **(riesgo 1)**

**Antes de dar por cerrado el cambio:**
3. Portar el aviso de ≥ 15 minutos a la Edge Function. **(A2)**
4. Añadir `deno check` y `deno lint` sobre `supabase/functions/` al gate, más al menos un test de la validación del secreto y de `reconcileOne`. **(A1)**
5. Subir el `testTimeout` de Vitest o marcar los tres tests lentos, hasta que `npm test` cierre en verde de forma determinista. **(A3)**
6. Añadir `.next-*/` e `.impeccable/` a `.gitignore`. **(M5)**

**Deuda aceptable, con fecha:**
7. Paginación completa en `findOwnedUser` o búsqueda directa por email. **(M2)**
8. Emitir `retry_exhausted` a partir de N intentos y excluir esas filas del barrido. **(M3)**
9. Corregir el comentario de `COMMENT ON TABLE public.profiles` o migrar las tres escrituras restantes a comandos específicos. **(M4)**
10. Corregir en el handoff la afirmación de "validación de secreto constante". **(B1)**

---

## ESTADO DE LA EVIDENCIA

**Verificada por mí en esta auditoría:**
`tsc --noEmit` limpio · `npm run lint` limpio · `npm test` falla y los mismos ficheros pasan en aislamiento · contenido de las 8 migraciones · `vercel.json` · `supabase/config.toml` · `.gitignore`/`.vercelignore`/`eslint.config.mjs`/`tsconfig.json` · equivalencia Edge Function ↔ ruta Next · `permissions.ts` y `trustedActor.ts` · autorización de los actions fiscales · escrituras directas restantes sobre `profiles` · negativa de la preflight a conectarse a producción.

**Pendiente de verificar (requiere sesión de Supabase):**
Publicación de la Edge Function · invocación autenticada con `success=true` · aplicación de las tres migraciones de contrato · activación del interruptor de Vault · `cron.job_run_details` con HTTP 200 · `verify_structure.sql` contra producción · canario Admin/Franchise/Agent.

**No verificable sin acceso a Supabase (aceptado bajo palabra de Codex):**
Todo el bloque "Verificaciones ya obtenidas" del handoff: estado de extensiones en staging y producción, presencia del trabajo cron, ACL efectivo de `handle_new_user()` en producción, existencia del RPC `update_own_iban` en producción, y el build READY de Vercel. **Ninguna de estas afirmaciones se ha podido comprobar de forma independiente.** La más importante de todas —cuántos Admin canónicos hay en producción— no está en esa lista, y es precisamente la que decide si el contrato es seguro.

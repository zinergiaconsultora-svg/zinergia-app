# Plan — Registro de Facturas con archivo en Google Drive

> Estado: **propuesta lista para implementar (v3 consolidada)** · Fecha: 2026-06-23
> Módulo dentro de zinergia (Next.js 16 + Supabase). No reescribe el flujo OCR/CRM existente.

---

## 1. Objetivo

Cada comercial sube una factura de energía. La app debe:

1. **Archivar el PDF/imagen en el Google Drive de `zinergiaconsultora@gmail.com`** (archivo oficial).
2. **Extraer los datos por OCR** (ya existe vía webhook n8n).
3. Mostrar un **registro de facturas con su estado del ciclo de vida** hasta el cierre.
4. Al cerrar el lead: compañía contratada, tarifa, **permanencia + recordatorio de revisión**, check de cerrado y **comisión** del comercial.
5. Cumplir **RGPD** en el trasvase de PII a un tercero (Google).

Comerciales ven lo suyo; admin ve todo (RLS existente por `owner_id` / `franchise_id` / `role`).

## 2. Qué ya existe (no se reconstruye)

| Necesidad | Pieza existente |
|---|---|
| Subida + OCR | `src/app/actions/ocr.ts` → Supabase Storage + webhook n8n |
| Seguimiento de estado | `ocr_jobs.status` (`processing`/`completed`/`failed`) + `extracted_data` |
| Datos factura | `ocr_jobs.extracted_data`, `client_documents` (categoría `factura`) |
| Comparativa | `COMPARISON_WEBHOOK_URL` (ver `docs/WEBHOOK_COMPARATIVA.md`) |
| Cliente: compañía/tarifa/CUPS | `clients.current_supplier`, `tariff_type`, `contracted_power`, `cups` |
| Permanencia + recordatorio | `contracts.end_date` + módulo `renewals` (RPC + `idx_contracts_end_date`) |
| Cerrado | `clients.status = 'won'` |
| Comisión | `network_commissions` (`agent_share`, `status`, `invoiced`) |
| Cifrado PII | `src/lib/crypto/pii.ts` (AES-GCM + blind index, claves `APP_ENCRYPTION_*`) |
| RGPD | `docs/rgpd-runbook.md`, migración `rgpd_purge`, `lib/audit` |

**Lo único nuevo:** capa Drive + vista de registro + cascada RGPD a Drive.

## 3. Decisiones cerradas

- **Auth Drive:** OAuth refresh token (cuenta Gmail de consumo). Scope **estricto `drive.file`** (no sensible → sin verificación Google, token no caduca).
- **Almacenamiento:** doble como **ciclo de vida** — Supabase = staging para OCR/preview; Drive = archivo oficial; purga del binario en Supabase tras sync confirmado.
- **Abstracción:** todo el acceso a Drive detrás de la interfaz `DriveStorage`, para poder migrar a Service Account + Workspace en el futuro sin tocar el resto.

### Decisiones finales (2026-06-23)

1. **Alcance inicial: solo `category='factura'`.** El resto de documentos (dni/contrato/escritura) se añaden en una iteración posterior; arrancamos con menos superficie RGPD.
2. **Regla operativa:** con scope `drive.file` la app solo ve lo que ella sube → **nadie reorganiza a mano** la carpeta "Facturas Zinergia". La estructura la gestiona la app (documentado en runbook).
3. **Métricas de éxito (gate previo al backfill):** ≥99% de facturas nuevas con `drive_synced_at` en <60s · 0 duplicados · 0 PII en nombres de fichero.
4. **Retención en Supabase `N=30 días`** tras `drive_synced_at` confirmado, luego se purga el binario (el preview sigue leyendo de Supabase durante la ventana).

---

## Fase 0 — Setup Google Drive (tarea humana, paralelizable con Fase 1/2)

1. GCP: proyecto → habilitar Drive API → crear **OAuth Client ID**.
2. Scope estricto `drive.file`. **Publicar** la consent screen ("In production").
3. Generar `refresh_token` para `zinergiaconsultora@gmail.com` (script local one-time).
4. Crear carpeta raíz "Facturas Zinergia"; anotar `rootFolderId`.
5. Endurecer la cuenta: **2FA + email de recuperación** (single point of failure).
6. Env (server-only): `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
   El **refresh token NO va en env**: se cifra y guarda en BD (Fase 1) con `lib/crypto/pii.ts`.
7. Documentar regeneración/rotación en `docs/google-drive-setup.md`.

**DoD Fase 0:** existe un refresh token válido, cifrable, y la consent screen está publicada.

## Fase 1 — Capa `DriveStorage` (desacoplada y resiliente)

Dependencia: `google-auth-library` + REST directa (evitar bundle pesado de `googleapis`).

`src/lib/drive/`:
- `credentials.ts` — lee refresh token **cifrado desde BD** (`integration_credentials`), descifra con `lib/crypto/pii.ts`. Rotación sin redeploy.
- `accessToken.ts` — refresca y cachea el access token **en memoria del proceso con fallback a BD** (memoria primero; BD si la lambda es fría). Evita agotar el endpoint de tokens en serverless. Distingue `invalid_grant` → marca integración `degraded` + alerta admin.
- `driveStorage.ts` — interfaz `DriveStorage`:
  - `uploadInvoice({ folderId, fileName, buffer, mimeType, documentId })` → `{ driveFileId, webViewLink }`. Resumable si >5 MB. Estampa `appProperties: { documentId }` para reconciliación.
  - `deleteInvoice(driveFileId)` — cascada RGPD.
  - `getViewLink(driveFileId)`.
- `folders.ts` — `resolveAgentFolder(agentId)` con **folder-id cacheado en `profiles.drive_folder_id`**, creación atómica (claim por `UPDATE ... WHERE drive_folder_id IS NULL`) anti-carrera. Estructura: **una carpeta por comercial**, nombrada con su `full_name`, conteniendo todas las facturas que sube → `/Facturas Zinergia/{comercial}/`.
- `__tests__/` — todo con API mockeada (sin red).

**DoD Fase 1:** subir/borrar/resolver carpeta funcionan contra mock; cobertura ≥80%.

## Fase 2 — Esquema (migración + tipos)

`supabase/migrations/2026XXXX_invoice_drive.sql`:
- `integration_credentials` (provider, encrypted_token, access_token, access_token_expires_at, status). RLS solo `service_role`.
- `clients.drive_folder_id text` + **unique(client_id)** para idempotencia de carpeta.
- `client_documents`: `drive_file_id`, `drive_view_link`, `drive_synced_at`, `file_hash`.
- `client_documents.invoice_status` enum: **`uploaded | ocr_done | compared`** (SOLO el tramo que no vive en otra tabla; el cierre se deriva de `clients.status` — sin duplicar verdad).
- Índices: `drive_file_id`; **único parcial** `(file_hash, client_id)`.
- Down-migration reversible.
- Regenerar tipos TS (`generate_typescript_types`).

## Fase 3 — Enganche en el flujo OCR (orden y consistencia)

En `actions/ocr.ts`, **BD = fuente de verdad, Drive después**:
1. Calcular `file_hash`. Idempotencia por `(file_hash, client_id)`: si existe con `drive_file_id`, **avisar (no bloquear)** → "ya existe, ¿reemplazar o duplicar?".
2. Subir a Supabase (staging) → crear `ocr_job` + fila `client_documents` (`drive_synced_at=null`, `invoice_status='uploaded'`).
3. Subir a Drive → set `drive_file_id`, `drive_view_link`, `drive_synced_at=now()`.
4. Si Drive falla: **no romper OCR**; queda "pendiente de Drive".
5. `retryDriveSync(documentId)` + **job de reconciliación** (Fase 4.5).
6. Observabilidad: breadcrumbs Sentry por paso + métrica de tasa de sync.

## Fase 3.5 — RGPD, seguridad y auditoría (crítica)

- **Cascada de supresión:** purgado RGPD y borrado de documento llaman a `deleteInvoice(driveFileId)`. La purga pasa de SQL puro a server action (Supabase + Drive). **Actualizar `docs/rgpd-runbook.md`** con el nuevo destino de PII.
- **Sin PII en nombres de fichero:** `{cups}-{yyyymm}-{shortuuid}.pdf` o solo UUID. La PII vive solo en BD cifrada.
- **Auditoría:** cada upload/delete Drive → `lib/audit`.
- **Base legal:** con Gmail de consumo **no hay DPA con Google** → recomendación formal de Workspace EU a medio plazo (documentado en runbook).

## Fase 4 — Vista "Registro de Facturas"

- **VIEW `invoice_registry`** (patrón `dashboard_rpc`): fila plana uniendo `client_documents` + `ocr_jobs` + `clients` + `contracts` + `network_commissions`, RLS heredada. Estado de cierre derivado de `clients.status`; tramo upload→compared de `invoice_status`; "archivada en Drive" = `drive_synced_at IS NOT NULL`.
- `src/features/invoices/`: `InvoiceRegistryView.tsx`, `hooks/useInvoices.ts` (SWR sobre `getInvoices()`).
- Ruta `src/app/dashboard/invoices/page.tsx` + entrada en `NavigationTop`.
- **Feature flag** `INVOICES_DRIVE_ENABLED` (rollout oscuro / por franquicia).
- Mini-panel admin: pendientes de Drive / failed / uso de cuota.

## Fase 4.5 — Ciclo de vida + reconciliación

- Tras `drive_synced_at` + N días, **purgar binario de Supabase** (cron), conservando enlace Drive (+ thumbnail opcional).
- **Reconciliación diaria:** (a) reintenta `drive_synced_at IS NULL` recientes; (b) marca `failed` + alerta los antiguos; (c) detecta archivos en Drive sin fila (vía `appProperties.documentId`) y reporta.
- Check de **cuota Gmail (15 GB)** → alerta admin al 80%.

## Fase 5 — Cierre del lead (reutiliza CRM)

Enlazar factura ↔ cliente al cerrar y capturar compañía/tarifa/**permanencia (`contracts.end_date`)**/`status='won'`/comisión. Verificar que el cron de `renewals` dispara el recordatorio real (push/email).

## Fase 6 — Pruebas

- **Unit:** `driveStorage`, `accessToken` (cache/expiry/`invalid_grant`), idempotencia hash, derivación de estado.
- **Integración:** OCR action con Drive mockeado (éxito, fallo+fallback, retry sin duplicar), cascada RGPD borra en Drive.
- **E2E:** subir → registro → badge Drive → enlace válido; comercial no ve lo de otros.
- **Aislamiento:** tests escriben en **carpeta/credenciales de Drive de test**, nunca en producción.
- **Manual:** 1 factura real aparece en el Drive de zinergiaconsultora.

---

## Dependencias y paralelización

- Fase 0 (humana) ‖ Fases 1+2 (código con mocks).
- Fase 3 depende de 1+2. Fase 3.5 depende de 1. Fase 4 depende de 2+3. Fase 5 es glue independiente.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Refresh token revocado | Detección `invalid_grant` + alerta + re-auth action |
| Cuenta Gmail = SPOF | 2FA + recuperación; Workspace a medio plazo |
| PII a tercero sin DPA | Nombres sin PII + auditoría + recomendación Workspace EU |
| Cuota 15 GB | Ciclo de vida + alerta 80% |
| Duplicados por retry | Idempotencia `(file_hash, client_id)` + reconciliación |

## Estimación: ~6,5–7 días

## Rollout

1. Flag ON solo para **facturas nuevas**; validar 1–2 semanas en prod.
2. **Backfill** histórico por lotes (rate-limit Drive) después.
3. Activar purga de Supabase (Fase 4.5) al final.

---

## Estado de implementación (actualizado 2026-06-23)

### Correcciones sobre el plan original al implementar
- **Tabla del registro:** la subida de facturas vive en **`ocr_jobs`** + bucket
  `ocr-invoices`, NO en `client_documents` (que es el gestor documental del
  cliente ya existente). Las columnas Drive y el ciclo se modelan en `ocr_jobs`.
- **Sin enum `invoice_status`:** `ocr_jobs.status` ya da `processing`(subida)/
  `completed`(ocr_done)/`failed`. Solo se añade **`compared_at`** para el estado
  "comparativa enviada". El cierre se deriva del cliente vinculado. Una sola
  fuente de verdad por hecho.
- **Dedup blando:** índice **no único** `(file_hash, agent_id)`. La idempotencia
  dura es **por job** (`drive_synced_at IS NULL`), no por hash → no bloquea
  re-subidos legítimos.
- **Carpetas por comercial:** `profiles.drive_folder_id`, nombre = `full_name`.

### Hecho y verificado (tests verdes, staging migrado)
- Fase 0: runbook + script auth + script save-token + env.
- Fase 1: capa Drive completa (`fileName`, `tokenClient`, `driveStorage`,
  `folders`, `credentials`, `index`).
- Fase 2: migración aplicada en **staging** (`ocr_jobs` drive cols + `compared_at`
  + `profiles.drive_folder_id` + `integration_credentials`).
- Fase 3: `archiveInvoiceToDrive` + `scheduleInvoiceArchive` (no bloqueante con
  `after()`, idempotente por job, feature-flag por env) enganchado en las dos
  acciones de `actions/ocr.ts`. Suite completa: 248/248.

### Hecho adicional (2026-06-23, tarde)
- **Fase 0 cerrada en staging:** refresh token cifrado en `integration_credentials`
  + **smoke test real** (token→carpeta→subida→link→borrado) ✅. Env de Drive +
  service role añadidas a `.env.staging.local`.
- **Limpieza:** se elimina `file_hash` (redundante con `ocr_jobs.file_content_hash`,
  dedup existente de `capture.ts`). Idempotencia de archivado = por job
  (`drive_synced_at`).
- **Fase 4 backbone:** VIEW `invoice_registry` creada (security_invoker) — deriva
  `process_status` de `ocr_jobs.status` + `compared_at` + `clients.status`, expone
  datos OCR, enlace Drive y compañía/tarifa/permanencia del contrato.

### Fase 4 UI (hecho)
- `getInvoicesAction()` sobre la VIEW (RLS por sesión) + `useInvoices` hook +
  `InvoiceRegistryView` (cards con estado, chip "En Drive ✓/Pendiente" enlazado,
  y si cerrada compañía/tarifa/permanencia) + ruta `/dashboard/invoices` + entrada
  "Facturas" en `NavigationTop`. `GRANT SELECT` a authenticated sobre la VIEW.
- 0 errores TS · 248/248 tests.

### Fase 3.5 RGPD (hecho)
- `purgeDriveFiles` (puro, testeado) + `purgeClientDriveFiles(clientIds)` (cableado,
  audita cada borrado con `logAdminAction('rgpd_drive_deletion', ...)`).
- Enganchado **antes** del cascade DB en: `eraseClientAction` (Art. 17),
  `deleteClientAction`, `deleteClientsBulk`, y el cron `purge-expired-clients`
  (recoge elegibles con los mismos criterios won>5y / inactivo>12m).
- 0 errores TS · 251/251 tests.

### Fase 4.5 reconciliación (núcleo hecho)
- `reconcilePendingDriveArchives()` — reintenta los `ocr_jobs` con
  `drive_synced_at IS NULL`: re-descarga el fichero de Storage
  (`extractStoragePath` + `mimeTypeForFileName`, puros y testeados) y reintenta el
  archivado. Best-effort.
- Cron `GET /api/cron/reconcile-drive` (auth `CRON_SECRET`) + registrado en
  `vercel.json` (02:30 diario). Necesita `CRON_SECRET` en el env (ya usado por
  los demás crons).
- 0 errores TS · 257/257 tests.

### Fase 5 cierre ligero (hecho)
- Enfoque elegido: **formulario ligero** en el registro + **comisión manual (€)**.
- Migración `invoice_closure`: columnas en `ocr_jobs` (`closed`, `closed_company`,
  `closed_tariff`, `permanence_until`, `commission_amount`, `closed_at`) + VIEW
  `invoice_registry` reescrita (basada solo en ocr_jobs, deriva `closed_won`).
- `closeInvoiceAction` / `reopenInvoiceAction` (validación zod, RLS por sesión) +
  modal "Cerrar" en `InvoiceRegistryView` (compañía, tarifa, permanencia con
  recordatorio, comisión €) + botón Reabrir.
- Verificado vía SQL: cierre → `process_status=closed_won`, comisión y permanencia
  en el registro. 0 errores TS · 257/257 tests.

### Verificación e2e (hecho, server-side)
- Probada la **cadena completa contra staging**: token cifrado en BD → descifrado →
  Drive → carpeta por comercial → `ocr_job` → `invoice_registry`. ✅
- El e2e **por la UI en local NO se pudo** por el entorno del usuario (turbopack
  lentísimo + `fetch failed` del middleware en edge runtime). No es la feature.
  La forma fiable de e2e por UI es **staging desplegado en Vercel**.

### Auditoría + mejoras (hecho)
- **Auditoría pre-deploy** completa: 0 bloqueantes, VIEW `security_invoker` OK, RLS
  `ocr_jobs` correcta, sin secretos commiteados, sin avisos de advisor nuevos.
- **Fix seguridad:** `REVOKE ALL ON integration_credentials FROM anon, authenticated`
  (defensa en profundidad para la tabla de secretos).
- **M2 — bucket `ocr-invoices`** creado (faltaba en el proyecto) + RLS por carpeta
  de usuario → habilita almacenamiento real y la reconciliación.
- **H1 — recordatorio de permanencia** (requisito explícito): columna
  `permanence_reminded_at`, `buildPermanenceReminder` (puro, testeado), cron
  `GET /api/cron/permanence-reminders` (notificación + push, 30d antes) en
  `vercel.json` (07:00 diario).
- 0 errores TS · 259/259 tests · 7 migraciones en staging.

### Ciclo Lead → Cliente (hecho)
- Toda factura subida es un **LEAD**; pasa a **CLIENTE** solo cuando el **admin**
  confirma que aceptó la oferta (el check de cierre).
- `closeInvoiceAction` / `reopenInvoiceAction` → **`requireServerRole(['admin'])`**
  (antes cualquier comercial podía cerrar). El RLS `admin_all` deja al admin cerrar
  cualquier lead.
- UI: badge **Lead/Cliente** prominente; botón "Pasar a cliente" y "Reabrir" solo
  visibles para admin; modal "Convertir lead en cliente". Rol resuelto en
  `page.tsx` vía `getUserRole()`.
- `getInvoiceFileUrlAction`: autoriza con el cliente de sesión (RLS) y firma con el
  service client → un admin puede abrir la factura de cualquier comercial.

### Proceso completo (hecho)
- **H2 — Ver factura:** `getInvoiceFileUrlAction` (signed URL de Supabase, RLS por
  sesión) + botón "Ver" en el registro → cualquier comercial abre su copia. El
  enlace de Drive queda como archivo oficial (admin).
- **Fase 4.5 completa** (housekeeping diario en el cron `reconcile-drive`):
  - **Huérfanos:** `cleanupOrphanDriveFiles` (list + `appProperties` → borra los de
    jobs inexistentes) — backstop RGPD. `findOrphanFileIds` puro/testeado.
  - **Ciclo de vida:** `purgeSyncedSupabaseBinaries(30d)` — borra el binario de
    Supabase 30d tras `drive_synced_at`; columna `binary_purged_at`.
  - **Cuota:** `checkDriveQuotaAndAlert(0.8)` — notifica + push a admins al 80%.
    `isQuotaOverThreshold` puro/testeado. `DriveStorage.listAppFiles`/`getStorageQuota`.
- 0 errores TS · 268/268 tests · 8 migraciones en staging.

### Pendiente (solo despliegue)
- e2e por UI en staging desplegado (en local no va por el entorno del usuario).
- **Producción:** probar migraciones en branch limpia → aplicarlas → Drive de
  producción (OAuth + carpeta + refresh token cifrado) → env Vercel → rotar los
  secretos de staging filtrados en el chat → regenerar `database.types.ts`.

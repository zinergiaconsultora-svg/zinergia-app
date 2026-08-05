# Runbook de despliegue — Facturas/Drive + Cockpit admin

Estado: **BD de producción ya migrada y verificada** (7 migraciones aplicadas a
`proyectozinergia`). Faltan los pasos de código, Drive de producción y env.

## ✅ Hecho (por el asistente)
- 7 migraciones aplicadas a producción (`proyectozinergia`) + verificadas:
  columnas de `ocr_jobs`, VIEW `invoice_registry` (security_invoker, 25 campos),
  `integration_credentials` (RLS, grants revocados), bucket `ocr-invoices` + 4
  políticas, funciones `get_lead_metrics`/`get_lead_agent_ranking` (INVOKER, sin
  acceso anon).
- La feature queda **dormida** en prod hasta que se despliegue el código y se
  configure Drive (sin env de Drive, `isDriveConfigured()` = false → el archivado
  hace no-op; nada se rompe).

## ⏳ Pendiente (tú)

### 1. Desplegar el código
Sube la rama con todo lo construido a producción (Vercel / tu flujo de git).
Incluye: `/dashboard/invoices`, `/admin/leads`, `/admin/drive`, acciones, crons.

### 2. Google Drive de producción
1. Carpeta raíz "Facturas Zinergia" en la cuenta de Drive de producción (puede ser
   la misma `zinergiaconsultora@gmail.com` o una dedicada). Copia su `folderId`.
2. Cliente OAuth: puedes reutilizar el `client_id`/`client_secret` actuales.
3. Genera el refresh token de **producción**:
   ```powershell
   $env:GOOGLE_DRIVE_CLIENT_ID="...";  $env:GOOGLE_DRIVE_CLIENT_SECRET="..."
   node scripts/google-drive-auth.mjs   # login con la cuenta de prod
   ```
4. Guárdalo cifrado en la BD de **producción** (con la `APP_ENCRYPTION_KEY` de prod):
   ```powershell
   $env:APP_ENCRYPTION_KEY="<prod>"
   $env:NEXT_PUBLIC_SUPABASE_URL="https://gmjgkzaxmkaggsyczwcm.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="<service role de prod>"
   $env:GOOGLE_DRIVE_REFRESH_TOKEN="<token de prod>"
   node scripts/google-drive-save-token.mjs
   ```

### 3. Variables de entorno en Vercel (Production)
- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_ROOT_FOLDER_ID` (nuevas).
- Confirma que ya existen en prod: `APP_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `WEBHOOK_API_KEY`.

### 4. Rotar secretos expuestos en el chat (staging)
El refresh token de Drive, la service role de staging y el client secret se
pegaron en la conversación. Rótalos cuando puedas (re-auth de Drive; regenerar
service role en Supabase staging si procede; restablecer client secret en GCP).

### 5. Verificación post-deploy
- Entra como **comercial** → Simulador → sube una factura → aparece en **Facturas**
  como **Lead** con "En Drive ✓".
- Entra como **admin** → **🎯 Leads** (métricas + cola) → "Pasar a cliente".
- **☁️ Drive** → estado integración "Activa", cuota, etc.

## ⚠️ Caveat de historial de migraciones
Las migraciones se aplicaron vía MCP y quedaron registradas en
`supabase_migrations.schema_migrations` con versión `20260624xxxxxx`, **distinta**
del timestamp de los archivos (`20260623xxxxxx`). Si en el futuro usas
`supabase db push`, intentará reaplicar los archivos (varios `CREATE POLICY` no son
idempotentes → fallarían). Antes de un `db push`, marca estas migraciones como
aplicadas:
```
supabase migration repair --status applied 20260623120000 20260623140000 \
  20260623150000 20260623160000 20260623170000 20260623180000 20260623190000
```
(o renombra los archivos a las versiones `20260624…` registradas).

### 6. Opcional
Regenerar `src/types/database.types.ts` para tipar las columnas/VIEW nuevas y
quitar los casts `as unknown as SupabaseClient`.

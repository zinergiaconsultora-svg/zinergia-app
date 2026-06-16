# Tests E2E (Playwright)

La suite vive en `e2e/` y cubre: login (`auth`), dashboard, simulador,
propuesta pública, panel admin y accesibilidad (`a11y`).

## Entorno de staging

Los E2E corren contra el proyecto Supabase de **staging** (`zinergia-staging`,
ref `dnzytocmtmnptndeczny`), **nunca contra producción**. El staging tiene el
mismo esquema que producción (aplicado con `supabase db push`) y datos de
tarifas cargados.

Usuarios de prueba ya creados en staging:
- Agente: `e2e-agent@zinergia.app`
- Admin:  `e2e-admin@zinergia.app`

## Cómo correrlos en local

1. Necesitas el archivo **`.env.staging.local`** en la raíz (gitignored). Ya
   está creado en la máquina de desarrollo con:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (staging)
   - `APP_ENCRYPTION_KEY` / `APP_ENCRYPTION_PEPPER` (staging)
   - `E2E_AGENT_EMAIL` / `E2E_AGENT_PASSWORD`
   - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
   - `PLAYWRIGHT_BASE_URL=http://localhost:3000`
   - `STAGING_DB_PASSWORD` (para `supabase db push` a staging)

   Para recrearlo en otra máquina, copia esos valores desde el dashboard de
   staging (URL + anon key en Settings → API; resetea la DB password en
   Settings → Database) y genera claves de cifrado con
   `node scripts/generate-encryption-keys.mjs`.

2. Instala los navegadores (una vez): `npx playwright install --with-deps chromium`
3. Ejecuta: `npm run test:e2e`
   - Playwright arranca automáticamente `npm run dev:staging`, que levanta la
     app cargando `.env.staging.local` (los valores de staging ganan sobre los
     de `.env.local`, que apuntan a producción). Tu `npm run dev` normal sigue
     usando producción sin cambios.
   - UI interactiva: `npm run test:e2e:ui`

## Re-aplicar esquema a staging

```
# con STAGING_DB_PASSWORD en .env.staging.local
npx supabase db push --db-url "postgresql://postgres.dnzytocmtmnptndeczny:<STAGING_DB_PASSWORD>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
```

## CI (pendiente, opcional)

Para correrlos en GitHub Actions: añadir los `E2E_*`, la URL/anon de staging y
las claves como **secrets**, y un job que despliegue una preview apuntando a
staging y ejecute `npm run test:e2e` con `PLAYWRIGHT_BASE_URL` = la URL de la
preview (`webServer` queda `undefined` cuando `CI=true`).

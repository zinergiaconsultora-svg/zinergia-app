# Tests E2E (Playwright)

La suite vive en `e2e/` y cubre: login (`auth`), dashboard, simulador,
propuesta pública, panel admin y accesibilidad (`a11y`).

## Estado

- La infraestructura está completa (config, specs, `global.setup.ts`).
- El setup **degrada con elegancia**: si no hay credenciales de test, escribe
  un estado de sesión vacío y los tests que requieren login se saltan, en vez
  de romper.
- **Lo único que falta para ejecutarla de verdad** son las credenciales de
  test y (en CI) una URL objetivo. Eso son secretos que debes proveer tú.

## Ejecutar en local

1. Crea dos usuarios de prueba en Supabase (uno `agent`, uno `admin`).
2. Añade a `.env.test.local` (o exporta en tu shell):

   ```
   E2E_AGENT_EMAIL=...
   E2E_AGENT_PASSWORD=...
   E2E_ADMIN_EMAIL=...
   E2E_ADMIN_PASSWORD=...
   # opcional; por defecto http://localhost:3000
   PLAYWRIGHT_BASE_URL=http://localhost:3000
   ```

3. Instala los navegadores (una vez): `npx playwright install --with-deps chromium`
4. Ejecuta: `npm run test:e2e` (arranca `npm run dev` automáticamente en local).
   - UI interactiva: `npm run test:e2e:ui`

## Habilitar en CI (GitHub Actions)

1. En **Settings → Secrets and variables → Actions**, añade:
   `E2E_AGENT_EMAIL`, `E2E_AGENT_PASSWORD`, `E2E_ADMIN_EMAIL`,
   `E2E_ADMIN_PASSWORD`, y `PLAYWRIGHT_BASE_URL` apuntando al **deployment de
   preview** del PR (en CI no se levanta `npm run dev`: `webServer` es
   `undefined` cuando `CI=true`).
2. Añade un job que, tras el deploy de preview, exporte esos secretos y corra
   `npx playwright install --with-deps chromium && npm run test:e2e`.

> Recomendado usar usuarios de prueba en un proyecto Supabase de **staging**,
> no en producción, para no ensuciar datos reales.

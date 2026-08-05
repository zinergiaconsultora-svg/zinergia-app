# Arquitectura de Zinergia para SDD

## Stack

- Next.js App Router.
- React + TypeScript.
- Supabase Postgres, Auth, Realtime and Storage.
- N8N webhook para OCR.
- Vercel hosting and cron.

## Dominio

Zinergia es un CRM energetico B2B para consultoria energetica en Espana.

Flujo principal:

1. Agente sube factura.
2. OCR extrae datos.
3. El sistema compara tarifas.
4. Se genera propuesta.
5. El cliente acepta/firma.
6. Se registra estado comercial y comisiones.

## Roles

- Admin: control total, tarifas, configuracion y comisiones.
- Franchise: gestiona su red y obtiene su corte de comisiones.
- Agent: sube facturas, gestiona clientes propios y ve sus comisiones.
- Cliente publico: accede solo a propuestas por token.

## Areas sensibles

- `src/app/actions/*`: server actions y mutaciones.
- `src/app/api/*`: route handlers, cron e integraciones.
- `src/lib/supabase/*`: clientes Supabase y service role.
- `src/lib/crypto/pii.ts`: cifrado y blind indexes.
- `supabase/migrations/*`: unica fuente de verdad del schema.
- `src/types/database.types.ts`: tipos generados desde Supabase.

## Regla de diseno

Cada spec debe declarar si afecta a:

- UI.
- Server actions.
- Route handlers.
- Supabase schema.
- RLS/policies.
- PII.
- Public routes.
- External integrations.
- Business calculations.


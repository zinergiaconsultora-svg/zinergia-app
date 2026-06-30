# Notas de seguridad — avisos del advisor que son INTENCIONALES

> Antes de "arreglar" un aviso del Supabase advisor, léelo aquí. Los listados
> abajo se dejaron a propósito tras una auditoría (jun 2026). Revocarlos o
> cambiarlos **rompe el RLS o la app**. No son fugas.

## 1. `integration_credentials` — RLS activo sin policy (INFO)

Tabla de **secretos** (tokens OAuth de Google Drive). RLS activo + sin policy +
sin grants = accesible **solo por `service_role`**. Es el estado correcto:
el código la usa exclusivamente vía service client (`src/lib/drive/credentials.ts`,
`src/app/actions/driveHealth.ts`). Añadir una policy permisiva la debilitaría.

**No añadir policy.**

## 2. Helpers RLS privados (resuelto para `anon`)

- `is_admin()`
- `is_superadmin()`
- `get_my_franchise_id()`
- `get_my_parent_id()`

Las políticas RLS ya no dependen de los wrappers públicos. Desde la auditoría
del 2026-06-29:

- Las políticas basadas en identidad usan `TO authenticated`, no `TO public`.
- Las propuestas públicas por token siguen con políticas `TO anon`, sin helpers.
- Los helpers reales viven en `private.*`, fuera del esquema expuesto.
- `anon` y `authenticated` no tienen `EXECUTE` sobre los wrappers `public.*`.

**No volver a conceder `EXECUTE` en los wrappers `public.*`.**
**No convertir los helpers privados a SECURITY INVOKER** (causaría recursión de RLS).

## 3. RPC de app ejecutables por `authenticated` (WARN intencional)

- `get_conversion_funnel(uuid)`
- `get_monthly_metrics(integer)`
- `get_expiring_contracts(integer)`
- `get_withdrawal_growth(uuid)`
- `generate_invoice_number(uuid)`

Las llama la app para **usuarios autenticados** (ver `src/services/crm/*` y
`src/app/actions/withdrawals.ts`). Son `SECURITY DEFINER` a propósito: agregan
datos por encima del RLS. Convertirlas a `SECURITY INVOKER` devolvería métricas
vacías o erróneas para no-admins.

Ya se les revocó el acceso a `anon`; el aviso restante para `authenticated` es
el comportamiento deseado mientras esas métricas sigan servidas como RPC.

**Mantener `EXECUTE` para `authenticated` + `service_role`. No tocar.**

## 4. `pg_net` en `public` (WARN no accionable por migración segura)

El advisor recomienda mover la extensión `pg_net` fuera de `public`, pero
Postgres responde:

`ERROR 0A000: extension "pg_net" does not support SET SCHEMA`

No hay referencias propias a `pg_net` en `src/` ni en migraciones de la app, y
sus funciones operativas viven en el esquema `net`. No hacer `DROP EXTENSION` /
`CREATE EXTENSION` en producción para cerrar este aviso sin una ruta soportada
por Supabase.

## 5. `auth_leaked_password_protection` — desactivado (WARN)

No es SQL: es un ajuste del dashboard de Supabase en
**Authentication → Attack Protection → "Prevent use of leaked passwords"**
(se configura dentro del proveedor Email). Activa la verificación de
contraseñas filtradas contra la API de HaveIBeenPwned.

**IMPORTANTE — solo disponible en plan Pro o superior.** El proyecto de
staging (`zinergia-staging`) está en plan Free, por lo que el toggle está
bloqueado y este aviso **no se puede cerrar** sin pasar a Pro. Es una
limitación del plan, no un descuido.

**Acción pendiente:** activarlo en el proyecto de **producción**
(`proyectozinergia`) cuando esté en plan Pro. En staging se deja como está.

---

### Qué SÍ se corrigió en la auditoría (para contexto)

- 6 vistas `SECURITY DEFINER` → `security_invoker = on` (fugaban datos a `anon`).
- `franchise_config` y `user_points`: RLS activo sin policy → se añadieron
  políticas con scope (estaban rompiendo funciones en silencio).
- `search_path` fijado en 15 funciones (`function_search_path_mutable`).
- Exposición RPC a `anon` revocada en todas las funciones no-helper + triggers.
- Tabla `proposal_alta_events` (auditoría de altas): RLS admin-only, escritura
  solo vía service role, `TRUNCATE` revocado (bypasea RLS).
- Caché SIPS: retirada la policy amplia de `authenticated`; acceso directo
  cerrado a `service_role`.
- Policies con `auth.uid()`/helpers: optimizadas con initplan (`SELECT`) y
  restringidas a `authenticated`.
- Helpers RLS movidos a `private.*`; wrappers `public.*` sin EXECUTE para API.
- Policies permisivas múltiples consolidadas a una policy por tabla/acción/rol.

Ver migraciones:
`20260626200000_alta_state_machine.sql`,
`20260626210000_preexisting_security_hardening.sql`,
`20260626220000_function_hardening.sql`,
`20260629100831_security_advisor_safe_fixes.sql`,
`20260629102514_rls_policy_role_and_initplan_hardening.sql`,
`20260629102757_revoke_anon_rls_helper_execute.sql`,
`20260629103133_drop_redundant_service_role_rls_policies.sql`,
`20260629103555_consolidate_permissive_policies_private_helpers.sql`,
`20260629104331_move_pg_net_extension_schema.sql`.

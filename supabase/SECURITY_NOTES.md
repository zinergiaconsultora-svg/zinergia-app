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

## 2. Funciones helper ejecutables por `anon`/`authenticated` (WARN)

- `is_admin()`
- `is_superadmin()`
- `get_my_franchise_id()`
- `get_my_parent_id()`

Son **infraestructura del RLS**. Decenas de políticas con rol `public` (que
incluye a `anon`) las invocan al evaluar el RLS — por ejemplo, un usuario
anónimo que firma una propuesta pública evalúa las políticas `public` de
`proposals`, que llaman a `is_superadmin()` / `get_my_franchise_id()`.

Si revocas su `EXECUTE` a `anon`/`authenticated`, esas consultas fallan con
`permission denied for function` y **se rompe el RLS de toda la base** (incluida
la firma de propuestas públicas).

Devuelven únicamente datos sobre el propio llamante (`anon` → `false`/`null`),
por lo que la exposición no es una fuga.

**No revocar. No convertir a SECURITY INVOKER** (causaría recursión de RLS).

## 3. RPC analíticas ejecutables por `authenticated` (WARN)

- `get_dashboard_stats(uuid)`
- `get_conversion_funnel(uuid)`
- `get_monthly_metrics(integer)`
- `get_expiring_contracts(integer)`
- `get_withdrawal_growth(uuid)`
- `generate_invoice_number(uuid)`

Las llama la app para **usuarios autenticados** (ver `src/services/crm/*` y
`src/app/actions/withdrawals.ts`). Son `SECURITY DEFINER` a propósito: agregan
datos por encima del RLS. Convertirlas a `SECURITY INVOKER` devolvería métricas
vacías o erróneas para no-admins.

Ya se les revocó el acceso a `anon` (auditoría jun 2026); el aviso restante para
`authenticated` es el comportamiento deseado.

**Mantener `EXECUTE` para `authenticated` + `service_role`. No tocar.**

## 4. `auth_leaked_password_protection` — desactivado (WARN)

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

Ver migraciones:
`20260626200000_alta_state_machine.sql`,
`20260626210000_preexisting_security_hardening.sql`,
`20260626220000_function_hardening.sql`.

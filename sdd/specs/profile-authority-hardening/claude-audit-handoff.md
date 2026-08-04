# Entrega de auditoría para Claude — ZIN-SDD-041

Fecha de corte: 2026-08-04 (Europe/Madrid)  
Objetivo: permitir una auditoría independiente, profunda y reproducible del endurecimiento de autoridad de perfiles y de su promoción a producción. Este archivo no contiene secretos, datos personales ni tokens.

## Resultado que se busca auditar

La aplicación Zinergia usa Next.js 16, TypeScript y Supabase. El cambio `ZIN-SDD-041 profile-authority-hardening` elimina escrituras directas amplias sobre `public.profiles`, centraliza las transiciones de autoridad en comandos protegidos y hace trazable el aprovisionamiento de invitaciones. El despliegue sigue el orden obligatorio:

1. Expansión aditiva de base de datos.
2. Aplicación compatible.
3. Contrato final de permisos y políticas.
4. Reconciliación automática de invitaciones cada cinco minutos.

La auditoría debe comprobar tanto que el contrato final es correcto como que no se ha adelantado a la aplicación compatible.

## Estado real por entorno

| Área | Staging (`dnzytocmtmnptndeczny`) | Producción (`gmjgkzaxmkaggsyczwcm`) |
| --- | --- | --- |
| Migraciones de autoridad | Completo hasta `20260803220752` | Compatible hasta `20260803214216` |
| Contrato final (`190000`, `191000`, `192000`) | Aplicado y verificado | Pendiente, intencionadamente |
| Cron de Supabase | Trabajo de 5 min creado, Vault configurado y `enabled=false` | No creado todavía |
| Edge Function | Código local preparado, no publicado | Código local preparado, no publicado |
| App compatible | Validada en staging | Vercel build READY; ID `dpl_7y5FG6TCEPxM2mWDJMqn47GveYTR` |
| Registro público Auth | Desactivado | Desactivado |

No declarar producción cerrada: publicar la Edge Function, configurar su secreto, activar el cron y aplicar el contrato final siguen pendientes.

## Cambios relevantes para revisar

### Base de datos y autorización

Revisar en orden los siguientes ficheros:

- `supabase/migrations/20260803150000_profile_authority_expand.sql`
- `supabase/migrations/20260803170000_restrict_handle_new_user_execute.sql`
- `supabase/migrations/20260803180000_add_update_own_iban_rpc.sql`
- `supabase/migrations/20260803190000_contract_profile_boundary.sql`
- `supabase/migrations/20260803191000_enforce_profile_authority_tuple.sql`
- `supabase/migrations/20260803192000_remove_legacy_profile_policies.sql`
- `supabase/migrations/20260803214216_revoke_legacy_handle_new_user_service_role.sql`
- `supabase/migrations/20260803220752_schedule_invitation_reconciler_with_supabase_cron.sql`

Puntos críticos:

- `public.handle_new_user()` sólo debe ser ejecutable por `supabase_auth_admin`; el ACL heredado de `service_role` se detectó en producción y se corrigió con la migración `20260803214216`.
- Ningún navegador debe recuperar la facultad de actualizar autoridad, red o rol directamente en `profiles`.
- Las operaciones de IBAN, fiscalidad, administración e invitaciones conservan sólo el permiso mínimo necesario.
- Los scripts de verificación no deben persistir datos de prueba ni PII.

### Reconciliación automática

Archivos:

- `src/app/api/cron/reconcile-invitation-provisioning/route.ts` — implementación Next existente, protegida por `CRON_SECRET`; ya no la llama el cron.
- `supabase/functions/reconcile-invitation-provisioning/index.ts` — nueva implementación Deno equivalente que el cron debe invocar.
- `supabase/config.toml` — `verify_jwt = false` sólo para esa función; la función valida obligatoriamente `Authorization: Bearer CRON_SECRET` antes de crear un cliente con service role.
- `scripts/profile-authority/configure-supabase-cron-vault.ps1` y `scripts/profile-authority/set-vault-secret.sql` — guardan URL, secreto y estado en Vault sin escribirlos en migraciones, logs ni `cron.job`.
- `supabase/migrations/20260803220752_schedule_invitation_reconciler_with_supabase_cron.sql` — instala extensiones idempotentemente y agenda `*/5 * * * *` con `pg_cron` + `pg_net`; URL y secreto se leen de Vault en tiempo de ejecución.

Hallazgo operativo: Vercel Hobby rechazó la frecuencia de cinco minutos. La entrada correspondiente se retiró de `vercel.json`. El despliegue posterior compiló bien, pero sus URLs directas devuelven la pantalla de protección de Vercel antes de alcanzar la API. Por ello apuntar Supabase Cron a Vercel sería incorrecto; la Edge Function evita esa dependencia.

### Vercel

- `vercel.json` mantiene los crons diarios permitidos y elimina sólo `reconcile-invitation-provisioning` con frecuencia de cinco minutos.
- `.vercelignore` ignora `.next-*` para no empaquetar salidas locales de compilación. Esto permitió un despliegue de sólo 346 B adicionales y un build remoto correcto.
- La compilación remota de producción terminó correctamente: TypeScript y 45 rutas, incluida `/api/cron/reconcile-invitation-provisioning`.
- No se ha desactivado la protección de despliegues de Vercel ni se debe hacer para resolver el cron.

## Verificaciones ya obtenidas

- Staging: extensiones `pg_cron`, `pg_net` y `supabase_vault` presentes tras la migración.
- Staging: trabajo `zinergia-reconcile-invitation-provisioning` presente con `*/5 * * * *`.
- Staging: `cron.job` no materializa URL ni secreto; ambos se resuelven de Vault en ejecución.
- Staging: el interruptor de Vault está en `false`, por lo que no genera tráfico externo durante las pruebas.
- Producción: extensiones `pg_cron 1.6.4`, `pg_net 0.19.5` y `supabase_vault 0.3.1` confirmadas antes de diseñar el cron.
- Producción: ACL de `handle_new_user()` verificado: `service_role` denegado y `supabase_auth_admin` permitido.
- Producción: RPC `update_own_iban` existente, permitido al service role y denegado al navegador.
- Vercel: build de producción READY del 2026-08-04, sin el error de frecuencia Hobby.

## Comprobaciones pendientes y criterio GO/NO-GO

1. Iniciar una sesión válida de Supabase CLI en la máquina operadora; no pegar tokens en chat ni en el repositorio.
2. Desplegar la Edge Function primero en staging y configurar allí `CRON_SECRET`; mantener `zinergia_reconcile_cron_enabled=false`.
3. Invocarla autenticadamente y comprobar respuesta JSON `success=true`; sin PII en salida.
4. Desplegar la misma función en producción, configurar el secreto de función y los tres secretos de Vault; aún con el interruptor a `false`.
5. Aplicar en producción, en este orden, las migraciones `20260803190000`, `20260803191000`, `20260803192000` y `20260803220752`.
6. Activar Vault con `zinergia_reconcile_cron_enabled=true`, esperar una ejecución y comprobar `cron.job_run_details`/respuesta `pg_net` con estado HTTP 200.
7. Ejecutar `supabase/scripts/profile-authority/verify_structure.sql` contra producción y un canario limitado Admin/Franchise/Agent.

NO-GO inmediato si la Edge Function acepta una llamada sin secreto, si un navegador recupera un permiso de autoridad, si cron expone una credencial en su catálogo, o si la verificación estructural falla.

## Evidencia y comandos seguros para Claude

No ejecutar cambios directamente contra producción durante una auditoría. Priorizar:

```powershell
git diff --check
npx tsc --noEmit
npm run lint
npm run test
node .\sdd\scripts\validate-sdd.mjs
```

Para revisar SQL, usar los verificadores existentes en `supabase/scripts/profile-authority/` y las migraciones. Las credenciales se leen desde archivos locales ignorados; no deben incluirse en una respuesta de auditoría.

## Riesgos y preguntas obligatorias para la auditoría

1. ¿La Edge Function replica con fidelidad el flujo de reconciliación de Next sin ampliar privilegios, condiciones de carrera o exposición de PII?
2. ¿Es correcto desactivar `verify_jwt` sólo porque la función aplica una validación de secreto constante y no acepta tráfico no autenticado?
3. ¿El uso de `vault.decrypted_secrets` en el comando de `pg_cron` mantiene los secretos fuera de catálogo y logs? ¿Hay un vector de lectura de `cron.job` que requiera un endurecimiento adicional?
4. ¿La migración de extensiones idempotente es segura en producción y staging?
5. ¿Las migraciones contractuales pendientes mantienen el orden expandir → aplicación compatible → contraer sin dejar huecos de permisos?
6. ¿La cobertura de pruebas distingue correctamente entre evidencia histórica ya aprobada y las nuevas piezas pendientes (Edge Function/Cron)?
7. ¿Hay cambios no relacionados, archivos locales o directorios generados que deben excluirse antes de un commit o una auditoría de alcance?

## Seguridad operacional

- No hay secretos en este archivo ni deben añadirse.
- Una contraseña de base de datos fue compartida previamente por el operador fuera del repositorio: debe rotarse al cerrar la promoción.
- No usar `SUPABASE_SERVICE_ROLE_KEY` fuera de los límites establecidos por el proyecto.
- No rebajar la protección de Vercel para hacer funcionar un cron; completar la ruta directa Supabase Cron → Edge Function.

# Encargo listo para Claude

Audita a fondo el trabajo `ZIN-SDD-041 profile-authority-hardening` en este repositorio. Empieza obligatoriamente por:

`sdd/specs/profile-authority-hardening/claude-audit-handoff.md`

Tu misión es una revisión adversarial de arquitectura, seguridad, migraciones, RLS/RPC, flujos de invitación y despliegue. No modifiques producción, no inventes evidencia y no pidas ni muestres secretos.

Revisa especialmente:

1. La secuencia de migraciones de `supabase/migrations/20260803150000_*` a `20260803220752_*`.
2. Que el contrato de permisos pendiente no se haya aplicado antes de que la aplicación compatible esté disponible.
3. Que `handle_new_user()` no sea ejecutable por `service_role` y que los navegadores no puedan actualizar autoridad, red ni rol directamente.
4. La equivalencia y seguridad de `supabase/functions/reconcile-invitation-provisioning/index.ts` respecto a `src/app/api/cron/reconcile-invitation-provisioning/route.ts`.
5. El diseño Supabase Cron → Vault → Edge Function: autenticación, exposición de secretos, privilegios y recuperabilidad.
6. La retirada exacta del cron de 5 minutos de `vercel.json`, sin romper los crons diarios existentes ni rebajar la protección de Vercel.
7. Cambios fuera de alcance, regresiones, archivos generados o configuraciones que no deberían entrar en el cambio.

Entrega un informe en español con esta estructura:

- Veredicto: `GO`, `GO CON CONDICIONES` o `NO-GO`.
- Hallazgos ordenados por criticidad (`Crítico`, `Alto`, `Medio`, `Bajo`), con archivo y línea cuando sea posible.
- Flujo de autorización actual y flujo objetivo tras el contrato final.
- Riesgos de despliegue/rollback y validaciones que faltan.
- Lista concreta y mínima de correcciones, si existen.
- Evidencia distinguida claramente entre: ya verificada, pendiente de verificar y no verificable sin acceso a Supabase.

No consideres producción terminada: la publicación de la Edge Function de Supabase, la activación de su cron y las tres migraciones contractuales siguen pendientes de una sesión válida de Supabase CLI.

# ZIN-SDD-041 — lista de promoción a producción

Estado: **bloqueada tras el checkpoint compatible**. La autorización de producto se recibió el 2026-08-03 y se aplicó únicamente la expansión compatible. La aplicación compatible ya está desplegada en Vercel y la configuración incompatible de cron de cinco minutos se ha retirado de Vercel Hobby. La continuación requiere publicar la Edge Function de Supabase, configurar su secreto, activar Supabase Cron y sólo después aplicar el contrato final.

## Antes de aprobar

- [ ] Confirmar por escrito el responsable, ventana de cambio y aprobación de producto.
- [ ] Confirmar que el objetivo es el proyecto de producción `gmjgkzaxmkaggsyczwcm`; no reutilizar credenciales ni URLs de staging.
- [ ] Archivar el commit, el artefacto desplegable y las versiones de migración revisadas: `20260803150000`, `20260803170000`, `20260803180000`, `20260803190000`, `20260803191000` y `20260803192000`.
- [ ] Confirmar que la aplicación compatible y el reconciliador de invitaciones están desplegados y sanos antes de contraer permisos.
- [ ] Verificar la configuración Auth prevista: registro público deshabilitado, confirmación de correo activa y proveedor Email configurado sin exponer secretos.
- [ ] Tener preparados CRON_SECRET, claves de cifrado y alertas, sin copiarlos a tickets, chat ni logs.
- [ ] Revisar la evidencia de staging: matriz REST, Auth bloqueado sin JWT, transacciones/auditoría, provisioning, concurrencia, tipos remotos y E2E autenticado.

## Ejecución autorizada

1. Hacer preflight de solo lectura y detenerse si hay desviaciones de esquema, Auth, permisos, reconciliador o alertas.
2. Aplicar únicamente las migraciones aprobadas, en orden, con la aplicación compatible ya disponible.
3. Tras la expansión, comprobar la salud del reconciliador y los eventos de autoridad sin PII.
4. En el checkpoint contractual, ejecutar el verificador estructural y la matriz REST con cuentas de prueba autorizadas.
5. Realizar un canario limitado: Admin, Franchise y Agent; validar directorio, invitación/provisioning y flujos personales/fiscales permitidos.
6. Archivar resultados sanitizados, versiones exactas y decisión GO/NO-GO.

## Parada y recuperación

Detener inmediatamente la promoción ante cualquier fallo de auditoría, provisioning, matriz REST, smoke o canario. Después del contrato **no** se recupera reabriendo grants amplios, políticas de escritura ni guardas de auditoría. La recuperación permitida es un forward-fix revisado, un kill switch de la aplicación compatible o la corrección del reconciliador; se conserva siempre la evidencia y se investiga antes de reanudar.

## Cierre

- [ ] El responsable de producto confirma el resultado y el archivo de evidencias.
- [ ] Se registra cualquier riesgo residual como seguimiento explícito, sin ampliar silenciosamente ZIN-SDD-042 ni ZIN-SDD-043.
- [ ] Se confirma de nuevo que no hubo secretos ni PII en la evidencia archivada.

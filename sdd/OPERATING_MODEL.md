# Operating Model

## Principio

Zinergia trabaja con SDD reforzado: primero se acuerda que debe ocurrir, despues como se hara, y solo entonces se toca codigo.

La fuente de verdad vive en archivos markdown dentro de `sdd/`, no en el chat.

## Flujo por feature

1. Clasificar la tarea en `feature_list.json`.
2. Si `sdd: true`, crear `sdd/specs/<feature>/`.
3. Redactar `requirements.md` con requisitos EARS y propiedades invariantes.
4. Puerta 1: el humano aprueba requisitos.
5. Redactar `design.md` con arquitectura, datos, seguridad, migraciones y plan de tests.
6. Puerta 2: el humano aprueba diseno.
7. Redactar `tasks.md` con pasos secuenciales y trazabilidad a requisitos.
8. Implementar tarea por tarea.
9. Verificar con los gates aplicables.
10. Puerta 3: revision de tests, seguridad y resultado.
11. Registrar cierre en `progress/history.md`.

## Puertas obligatorias

### Puerta 0: Clasificacion

Una tarea es automaticamente `sdd: true` si toca datos, roles, RLS, PII, propuestas publicas, cron, OCR, comisiones, tarifas o integraciones externas.

### Puerta 1: Requisitos

Cada requisito debe:

- Tener un ID estable: `REQ-001`, `REQ-002`, etc.
- Estar escrito de forma comprobable.
- Indicar rol afectado cuando aplique.
- Tener al menos una idea de prueba o verificacion.

### Puerta 2: Diseno

El diseno debe declarar:

- Archivos y modulos afectados.
- Tablas, policies, funciones o migraciones.
- Roles y permisos.
- Datos sensibles y tratamiento de PII.
- Rutas publicas, rate limiting y validacion.
- Plan de tests.
- Riesgos y plan de rollback.

### Puerta 3: Verificacion

Antes de cerrar:

- Los requisitos tienen tests o una justificacion explicita.
- `npx tsc --noEmit` pasa o se documenta por que no se pudo ejecutar.
- `npm run lint` pasa o se documenta por que no se pudo ejecutar.
- `npm run test` pasa o se documenta por que no se pudo ejecutar.
- `npm run build` pasa para cambios de seguridad/datos o se documenta el bloqueo.
- `CHECKPOINTS.md` queda satisfecho.

## Estados

- `pending`: idea registrada.
- `requirements_draft`: requisitos en preparacion.
- `requirements_ready`: requisitos listos para aprobacion.
- `design_draft`: diseno en preparacion.
- `design_ready`: diseno listo para aprobacion.
- `tasks_ready`: tareas listas para implementar.
- `in_progress`: implementacion activa. Solo una feature puede estar aqui.
- `verification`: implementacion terminada, verificando.
- `done`: cerrada y registrada.
- `blocked`: bloqueada por decision, acceso o informacion externa.

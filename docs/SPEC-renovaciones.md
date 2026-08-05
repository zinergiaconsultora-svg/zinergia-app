# SPEC: Módulo de Renovaciones

## Resumen

Detectar automáticamente clientes cuyo contrato con la comercializadora está próximo a vencer (permanencia) y generar alertas para que el agente pueda ofrecerles una nueva comparativa antes de que renueven automáticamente en peores condiciones.

## Problema

Los clientes que ganan (closed_won) tienen una fecha de permanencia (`permanence_until`) almacenada en `ocr_jobs`. Cuando esta fecha se acerca, el cliente podría renovar automáticamente con la comercializadora actual a un precio peor. No hay ningún mecanismo que alerte al agente para que contacte al cliente proactivamente.

## Solución propuesta

1. Un cron job (edge function o GitHub Action) que cada día revise leads cerrados (won) cuya permanencia vence en los próximos 30/60/90 días.
2. Crear una entrada en `lead_audit_events` de tipo `renewal_alert`.
3. Mostrar estos leads en una cola operacional nueva ("Renovaciones próximas") en el panel admin.
4. Opcionalmente enviar un email al agente responsable.

## Usuarios afectados

- [x] Admin
- [x] Franquicia
- [x] Agente
- [ ] Cliente (público)

## Modelo de datos

- `ocr_jobs.permanence_until` — ya existe
- `lead_audit_events` — nuevo event_type: `renewal_alert`
- Posible nueva tabla `renewal_campaigns` si se quiere tracking de contacto

## Fuera de alcance

- Auto-generación de nueva propuesta (eso es fase 2)
- Contacto automático con el cliente

## Criterios de aceptación

- [x] El cron detecta leads con permanencia a <60 días
- [x] Se crea audit event visible en el drawer del lead
- [x] Cola operacional "Renovaciones" funciona con filtro
- [ ] Email al agente (opcional, configurable)

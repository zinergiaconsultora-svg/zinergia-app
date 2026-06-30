# SDD reforzado para Zinergia

Este directorio es la fuente de verdad para trabajar features importantes con Spec-Driven Development en Zinergia.

El objetivo no es burocracia: es evitar cambios ambiguos en una app con datos sensibles, roles, Supabase, RLS, OCR, propuestas publicas y calculos de negocio.

## Estructura

- `OPERATING_MODEL.md`: como trabajamos una feature de principio a fin.
- `feature_list.json`: backlog SDD con estado, riesgo y prioridad.
- `CHECKPOINTS.md`: definicion de terminado reforzada para Zinergia.
- `docs/`: arquitectura, convenciones, verificacion y reglas de seguridad.
- `templates/`: plantillas para nuevas specs.
- `specs/`: una carpeta por feature importante.
- `progress/`: estado actual e historial.

## Cuando usar SDD

Usa `sdd: true` si el cambio toca cualquiera de estas areas:

- Supabase schema, migrations, RLS, policies, functions, triggers or indexes.
- Roles Admin, Franchise or Agent.
- PII, especially CUPS or DNI.
- OCR, N8N, proposal generation, public proposal acceptance or signature.
- Cron routes, service role work or external integrations.
- Commission splits, tariff comparison or business-critical calculations.

Usa `sdd: false` para cambios pequenos, copy, ajustes visuales locales o fixes triviales sin impacto funcional.

## Verificar el arnes

```powershell
node sdd/scripts/validate-sdd.mjs
```

Este comando valida estructura, JSON, estados permitidos y que no haya mas de una feature `in_progress`.

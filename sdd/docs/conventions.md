# Convenciones SDD de Zinergia

## Requisitos

- Usar IDs `REQ-001`, `REQ-002`, etc.
- Escribir requisitos verificables.
- Preferir formato EARS:
  - `WHEN <trigger>, the system shall <response>.`
  - `IF <unwanted condition>, THEN the system shall <response>.`
  - `WHILE <state>, the system shall <response>.`
- Incluir propiedades invariantes para reglas que siempre deben cumplirse.

## Diseno

Cada `design.md` debe incluir:

- Scope.
- Non-goals.
- Risk profile.
- Affected files.
- Data model and migrations.
- Security and privacy.
- Test plan.
- Rollback plan.
- Open questions.

## Tareas

- Maximo dos niveles de jerarquia.
- Cada tarea debe tener trazabilidad a uno o mas `REQ-*`.
- Las tareas deben estar en orden de ejecucion.
- No mezclar refactors no relacionados.

## Codigo

- Seguir patrones existentes del repo.
- No introducir abstracciones si no reducen complejidad real.
- No tocar archivos no relacionados.
- Para librerias/frameworks, usar Context7 antes de responder o cambiar APIs.


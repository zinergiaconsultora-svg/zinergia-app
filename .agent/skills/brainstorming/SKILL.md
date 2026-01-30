---
name: brainstorming
description: Úsese ANTES de cualquier trabajo creativo - crear features, componentes, añadir funcionalidad o modificar comportamiento. Explora la intención del usuario, requisitos y diseño antes de la implementación mediante diálogo colaborativo Socrático.
---

# Brainstorming: Transformar Ideas en Diseños

## Cuándo usar esta skill

- Antes de crear nuevas features o componentes
- Antes de añadir funcionalidad o modificar comportamiento existente
- Cuando el usuario tiene una idea que necesita refinamiento
- Cuando se requiere explorar alternativas y trade-offs
- El usuario menciona "diseñar", "planear", "cómo debería", "explorar opciones"

## Overview

Ayuda a transformar ideas vagas en diseños completamente formados y especificaciones mediante diálogo colaborativo natural.

Comienza entendiendo el contexto actual del proyecto, luego hace preguntas una a la vez para refinar la idea. Una vez que comprendes lo que se está construyendo, presenta el diseño en secciones pequeñas (200-300 palabras), verificando después de cada sección si se ve correcto hasta ahora.

## El Proceso

### 1. Entender la Idea

- **Revisar el contexto del proyecto primero**: Archivos, docs, commits recientes
- **Hacer preguntas una a la vez** para refinar la idea
- **Preferir preguntas de opción múltiple** cuando sea posible, pero open-ended está bien también
- **Solo una pregunta por mensaje**: Si un tema necesita más exploración, dividirlo en múltiples preguntas
- **Enfocarse en entender**: Propósito, restricciones, criterios de éxito

**Ejemplo de buenas preguntas**:

```markdown
¿Cuál es el objetivo principal de esta feature?
A) Mejorar la experiencia del usuario
B) Optimizar el rendimiento
C) Añadir nueva funcionalidad
D) Otro (especificar)
```

### 2. Explorar Enfoques

- **Proponer 2-3 enfoques diferentes** con trade-offs
- **Presentar opciones conversacionalmente** con tu recomendación y razonamiento
- **Liderar con tu opción recomendada** y explicar por qué

**Estructura de exploración**:

```markdown
He identificado 3 enfoques posibles:

**Opción A (Recomendada)**: [Descripción]
✅ Ventajas: ...
❌ Desventajas: ...

**Opción B**: [Descripción]
✅ Ventajas: ...
❌ Desventajas: ...

**Opción C**: [Descripción]
✅ Ventajas: ...
❌ Desventajas: ...

Recomiendo la Opción A porque [razones pragmáticas].
¿Qué opción prefieres?
```

### 3. Presentar el Diseño

- **Una vez que crees que entiendes** lo que se está construyendo, presenta el diseño
- **Dividir en secciones de 200-300 palabras**
- **Preguntar después de cada sección** si se ve correcto hasta ahora
- **Cubrir**: Arquitectura, componentes, flujo de datos, manejo de errores, testing
- **Estar listo para volver atrás** y aclarar si algo no tiene sentido

**Secciones típicas del diseño**:

1. Arquitectura general
2. Componentes principales y responsabilidades
3. Flujo de datos
4. Manejo de errores y casos edge
5. Estrategia de testing
6. Plan de implementación (high-level)

## Después del Diseño

### Documentación

Una vez validado el diseño:

1. **Escribir el diseño validado** a `docs/plans/YYYY-MM-DD-<tema>-design.md`
2. Usar formato markdown claro y conciso
3. **Commit del documento de diseño** a git:

   ```bash
   git add docs/plans/YYYY-MM-DD-<tema>-design.md
   git commit -m "docs: add design for <tema>"
   ```

**Estructura del documento de diseño**:

```markdown
# Diseño: [Nombre del Feature]

**Fecha**: YYYY-MM-DD
**Autor**: [Nombre o "AI + Usuario"]

## Objetivo

[Una frase describiendo qué se construye y por qué]

## Contexto

[Background necesario]

## Arquitectura

[Descripción de alto nivel]

## Componentes

[Detalles de componentes, responsabilidades, interfaces]

## Flujo de Datos

[Cómo fluye la información]

## Manejo de Errores

[Casos edge, validaciones, recuperación]

## Testing

[Estrategia de testing]

## Decisiones de Diseño

[Decisiones importantes con justificación - el "Por qué"]
```

### Implementación (Si se continúa)

Si el usuario quiere proceder con la implementación:

1. **Preguntar**: "¿Listo para configurar la implementación?"
2. **Usar la skill de planificación** para crear el plan de implementación detallado
3. **Mantener el enfoque pragmático**: Solo lo necesario, nada de sobre-ingeniería

## Principios Clave (Alineados con Directiva Principal v2.0)

### Una Pregunta a la Vez

No abrumes con múltiples preguntas. Mantén el diálogo fluido y manejable.

### Opción Múltiple Preferida

Más fácil de responder que preguntas totalmente abiertas cuando sea posible.

### YAGNI Despiadadamente

**You Aren't Gonna Need It**: Elimina características innecesarias de todos los diseños. Si no es esencial para el MVP, no está en el diseño inicial.

### Explorar Alternativas

Siempre proponer 2-3 enfoques antes de decidir. Pero no análisis-parálisis: proponer, decidir, avanzar.

### Validación Incremental

Presenta el diseño en secciones, valida cada una. No sueltes un documento de 10 páginas de golpe.

### Ser Flexible

Volver atrás y aclarar cuando algo no tiene sentido. El diseño no es sagrado hasta que está validado.

### Pragmatismo sobre Perfección

Siguiendo la Directiva Principal v2.0:

- **Abstraer solo lo crítico** (DB, Auth, Pagos). No envolver utilidades estándar.
- **Refactorización despiadada**: Si algo es redundante o confuso, eliminarlo.
- **Semántica sobre comentarios**: El diseño debe ser claro; los comentarios solo para el "Por qué".

## Checklist de Brainstorming

Antes de finalizar el diseño, verificar:

- [ ] ¿Se ha entendido el contexto actual del proyecto?
- [ ] ¿Se han hecho preguntas suficientes para clarificar la intención?
- [ ] ¿Se han explorado al menos 2-3 alternativas con trade-offs?
- [ ] ¿Se ha presentado el diseño en secciones validadas incrementalmente?
- [ ] ¿El diseño cubre arquitectura, componentes, flujo de datos, errores, testing?
- [ ] ¿Se ha aplicado YAGNI despiadadamente (solo lo esencial)?
- [ ] ¿El diseño es escalable y legible?
- [ ] ¿Se ha documentado el diseño en `docs/plans/`?
- [ ] ¿Se ha hecho commit del documento de diseño?

## Antipatrones a Evitar

❌ **No hacer**:

- Asumir requisitos sin preguntar
- Presentar diseño completo de golpe sin validación incremental
- Incluir features "nice to have" (YAGNI)
- Diseñar para casos de uso futuros hipotéticos
- Crear abstracciones prematuras
- Documentar sin commit a git

✅ **Hacer**:

- Preguntas una a la vez, clear y concisas
- Validación sección por sección
- Solo lo esencial para el objetivo actual
- Diseñar para casos de uso conocidos y reales
- Abstraer solo lo volátil y crítico (DB, Auth, Pagos)
- Documentar Y hacer commit para rastreabilidad

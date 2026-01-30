---
name: planificacion
description: Úsese cuando tengas una spec o requerimientos para una tarea multi-paso, ANTES de tocar código. Crea planes de implementación exhaustivos con granularidad de 2-5 minutos por tarea, asumiendo contexto cero del ingeniero.
---

# Planificación: Escribir Planes de Implementación

## Cuándo usar esta skill

- Tienes una spec o diseño validado (ej. desde brainstorming)
- Necesitas implementar una feature multi-paso
- Antes de tocar cualquier código
- Requieres un plan detallado con tareas bite-sized
- El usuario menciona "plan de implementación", "cómo implementar", "paso a paso"

## Overview

Escribe planes de implementación exhaustivos **asumiendo que el ingeniero tiene contexto cero** de nuestra codebase y gusto cuestionable. Documenta todo lo que necesitan saber: qué archivos tocar para cada tarea, código completo, testing, docs que puedan necesitar revisar, cómo testearlo. Dale todo el plan en tareas bite-sized.

**Principios obligatorios**: DRY, YAGNI, TDD, commits frecuentes.

Asume que son un desarrollador hábil, pero saben casi nada de nuestro toolset o dominio del problema. Asume que no conocen muy bien el diseño de buenos tests.

> [!IMPORTANT]
> **Anunciar al inicio**: "Estoy usando la skill de planificación para crear el plan de implementación."

**Guardar planes en**: `docs/plans/YYYY-MM-DD-<nombre-feature>.md`

---

## Granularidad de Tareas Bite-Sized

**Cada step es una acción (2-5 minutos)**:

1. "Escribir el test que falla" - step
2. "Ejecutarlo para asegurar que falla" - step
3. "Implementar el código mínimo para hacer pasar el test" - step
4. "Ejecutar los tests y asegurar que pasan" - step
5. "Commit" - step

**Ejemplo de granularidad CORRECTA**:

```markdown
### Tarea 1: Validación de Email en UserForm

**Step 1**: Escribir test que falla para validación de email
**Step 2**: Ejecutar test (debe fallar con "validación no implementada")
**Step 3**: Implementar función validateEmail()
**Step 4**: Ejecutar test (debe pasar)
**Step 5**: Commit
```

**Ejemplo de granularidad INCORRECTA** (muy amplio):

```markdown
❌ Tarea 1: Implementar validación de formulario completa
```

---

## Estructura del Documento de Plan

### Header Obligatorio

**TODOS los planes DEBEN empezar con este header**:

```markdown
# Plan de Implementación: [Nombre del Feature]

**Fecha**: YYYY-MM-DD
**Basado en diseño**: `docs/plans/YYYY-MM-DD-<nombre>-design.md` (si aplica)

> [!NOTE]
> **Para el implementador**: Sigue este plan tarea por tarea. Cada step es <= 5 minutos.
> Usa DRY, YAGNI, TDD. Commit frecuente.

## Objetivo

[Una frase describiendo qué construye este plan]

## Arquitectura

[2-3 frases sobre el enfoque técnico]

## Tech Stack

[Tecnologías/librerías clave que se usarán]

---
```

---

## Estructura de Tarea

Cada tarea debe seguir este template exacto:

```markdown
### Tarea N: [Nombre del Componente/Feature]

**Archivos**:
- Crear: `ruta/exacta/del/archivo.py`
- Modificar: `ruta/exacta/del/existente.py:123-145` (líneas aproximadas)
- Test: `tests/ruta/exacta/del/test.py`

---

#### Step 1: Escribir el test que falla

**Descripción**: [Qué estamos testeando]

**Código del test**:
```python
# tests/ruta/exacta/del/test.py
def test_comportamiento_especifico():
    """Test que verifica [comportamiento]"""
    resultado = funcion(entrada)
    assert resultado == esperado
```

**Razón**: [Por qué este test primero - el "Por qué"]

---

#### Step 2: Ejecutar test para verificar que falla

**Comando**:

```bash
pytest tests/ruta/test.py::test_comportamiento_especifico -v
```

**Output esperado**:

```
FAILED - Error: funcion not defined
```

**Verificación**: El test debe fallar con el error esperado, confirmando que estamos testeando algo que aún no existe.

---

#### Step 3: Escribir implementación mínima

**Descripción**: Implementar solo lo necesario para hacer pasar el test (YAGNI).

**Código**:

```python
# ruta/exacta/del/archivo.py
def funcion(entrada):
    """[Docstring claro]"""
    # Implementación mínima
    return esperado
```

**Razón**: [Por qué esta implementación específica]

---

#### Step 4: Ejecutar test para verificar que pasa

**Comando**:

```bash
pytest tests/ruta/test.py::test_comportamiento_especifico -v
```

**Output esperado**:

```
PASSED
```

**Verificación**: El test debe pasar. Si no pasa, revisar la implementación.

---

#### Step 5: Commit

**Comando**:

```bash
git add tests/ruta/test.py ruta/exacta/del/archivo.py
git commit -m "feat: add [descripción concisa del feature]"
```

**Verificación**: Commit exitoso. El código queda en el historial.

---

```

---

## Principios del Plan (Directiva Principal v2.0)

### Rutas Exactas Siempre
No "añade un archivo de configuración". Di `config/app.config.json`.

### Código Completo en el Plan
No "añade validación". Muestra el código completo:
```python
def validate_email(email: str) -> bool:
    import re
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email) is not None
```

### Comandos Exactos con Output Esperado

No "ejecuta los tests". Di:

```bash
pytest tests/unit/test_validator.py -v
# Esperado: PASSED (2 tests)
```

### DRY, YAGNI, TDD

- **DRY** (Don't Repeat Yourself): Si el código se repite, refactorizar
- **YAGNI** (You Aren't Gonna Need It): Solo implementar lo necesario ahora
- **TDD** (Test-Driven Development): Test primero, luego código

### Commits Frecuentes

Después de cada tarea completada (RED-GREEN-REFACTOR), hacer commit.

### Refactorización Despiadada

Si el plan identifica código redundante o confuso en el sistema existente, incluye un step para eliminarlo/refactorizarlo. Explica brevemente por qué era problemático.

---

## Checklist de Validación del Plan

Antes de finalizar el plan, verificar:

- [ ] ¿Cada tarea es <= 5 minutos de trabajo?
- [ ] ¿Todas las rutas de archivos son exactas y completas?
- [ ] ¿El código en el plan es completo (no placeholders como "// implementar lógica")?
- [ ] ¿Cada comando tiene el output esperado documentado?
- [ ] ¿Se sigue el ciclo RED-GREEN-REFACTOR (test que falla → código → test que pasa)?
- [ ] ¿Se aplicó YAGNI (solo lo esencial)?
- [ ] ¿Se aplicó DRY (sin código duplicado)?
- [ ] ¿Hay commits frecuentes después de cada tarea?
- [ ] ¿El plan está guardado en `docs/plans/YYYY-MM-DD-<nombre>.md`?
- [ ] ¿Se ha hecho commit del plan?

---

## Ejemplo Completo de Tarea

```markdown
### Tarea 1: Validación de Email en UserForm

**Archivos**:
- Crear: `src/validators/email_validator.py`
- Test: `tests/unit/test_email_validator.py`
- Modificar: `src/forms/user_form.py:45-48`

---

#### Step 1: Escribir el test que falla

**Descripción**: Validar que emails válidos son aceptados y emails inválidos son rechazados.

**Código del test**:
```python
# tests/unit/test_email_validator.py
import pytest
from src.validators.email_validator import validate_email

def test_valid_email():
    """Emails válidos deben pasar la validación"""
    assert validate_email("user@example.com") is True
    assert validate_email("test.user@domain.co") is True

def test_invalid_email():
    """Emails inválidos deben fallar la validación"""
    assert validate_email("invalid") is False
    assert validate_email("@example.com") is False
    assert validate_email("user@") is False
```

**Razón**: TDD - escribimos el test primero para definir el contrato de la función.

---

#### Step 2: Ejecutar test para verificar que falla

**Comando**:

```bash
pytest tests/unit/test_email_validator.py -v
```

**Output esperado**:

```
FAILED - ModuleNotFoundError: No module named 'src.validators.email_validator'
```

**Verificación**: Falla porque el módulo no existe aún.

---

#### Step 3: Escribir implementación mínima

**Descripción**: Crear validador simple usando regex.

**Código**:

```python
# src/validators/email_validator.py
import re

def validate_email(email: str) -> bool:
    """
    Valida formato de email usando regex básico.
    
    Args:
        email: String del email a validar
        
    Returns:
        True si el email es válido, False en caso contrario
    """
    if not email or not isinstance(email, str):
        return False
    
    # Regex para validación básica de email
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email) is not None
```

**Razón**: Implementación mínima que satisface los tests. No sobre-ingeniería (YAGNI).

---

#### Step 4: Ejecutar test para verificar que pasa

**Comando**:

```bash
pytest tests/unit/test_email_validator.py -v
```

**Output esperado**:

```
test_valid_email PASSED
test_invalid_email PASSED
```

**Verificación**: Ambos tests pasan.

---

#### Step 5: Commit

**Comando**:

```bash
git add tests/unit/test_email_validator.py src/validators/email_validator.py
git commit -m "feat: add email validation with regex"
```

**Verificación**: Commit exitoso.

---

```

---

## Después de Crear el Plan

Una vez guardado el plan en `docs/plans/YYYY-MM-DD-<nombre>.md`:

1. **Hacer commit del plan**:
   ```bash
   git add docs/plans/YYYY-MM-DD-<nombre>.md
   git commit -m "docs: add implementation plan for <feature>"
   ```

1. **Ofrecer opciones de ejecución**:

   "Plan completo y guardado en `docs/plans/<filename>.md`. ¿Listo para implementar? Puedo proceder tarea por tarea siguiendo este plan."

---

## Antipatrones a Evitar

❌ **No hacer**:

- Tareas demasiado amplias (> 5 minutos)
- Rutas genéricas como "añade un archivo de config"
- Código con placeholders: `// TODO: implementar lógica`
- Comandos sin output esperado
- Olvidar el ciclo RED-GREEN-REFACTOR
- Incluir features "nice to have" (violar YAGNI)
- No hacer commit del plan mismo

✅ **Hacer**:

- Tareas granulares (2-5 minutos cada una)
- Rutas exactas: `config/database/postgres.config.json`
- Código completo y funcional en el plan
- Comandos con output esperado documentado
- Siempre RED (test falla) → GREEN (test pasa) → COMMIT
- Solo lo esencial para el objetivo (YAGNI)
- Commit del plan para rastreabilidad

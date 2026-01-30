---
name: solucion-problemas
description: Úsese para implementar manejo robusto de errores, depurar problemas en producción, diseñar APIs resilientes y aplicar estrategias de recuperación. Cubre patrones de manejo de errores por lenguaje (Python, TypeScript, Rust, Go) y mejores prácticas universales.
---

# Solución de Problemas: Manejo Robusto de Errores

## Cuándo usar esta skill

- Implementar manejo de errores en nuevas funcionalidades
- Diseñar APIs resilientes a errores
- Depurar problemas en producción o staging
- Mejorar la fiabilidad de la aplicación
- Crear mejores mensajes de error (usuarios y desarrolladores)
- Implementar patrones de reintento (retry) y cortocircuito (circuit breaker)
- Manejar errores asíncronos o concurrentes
- Construir sistemas distribuidos tolerantes a fallos
- El usuario menciona "error", "fallo", "crash", "retry", "timeout", "debugging"

## Overview

Construye aplicaciones resilientes con estrategias robustas de manejo de errores que gestionen los fallos con elegancia y proporcionen excelentes experiencias de depuración.

Esta skill te guía a través de:

1. **Diagnóstico**: Identificar el tipo de error y su categoría
2. **Estrategia**: Elegir el patrón de manejo apropiado
3. **Implementación**: Aplicar el patrón específico del lenguaje
4. **Verificación**: Asegurar que el error se maneja correctamente

---

## Proceso de Diagnóstico

### 1. Identificar el Tipo de Error

**¿Es recuperable o irrecuperable?**

**Errores Recuperables** (manejar con gracia):

- ✅ Timeouts de red
- ✅ Archivos faltantes (si no son vitales)
- ✅ Entrada de usuario inválida
- ✅ Límites de tasa de API (rate limits)
- ✅ Servicios externos caídos temporalmente

**Errores Irrecuperables** (fail fast, panic/crash):

- ❌ Memoria agotada (OOM)
- ❌ Desbordamiento de pila (stack overflow)
- ❌ Bugs de programación (null pointers, lógica rota)
- ❌ Invariantes del sistema violadas

### 2. Elegir Filosofía de Manejo

**Opciones disponibles**:

| Filosofía | Cuándo Usar | Ejemplo |
|:----------|:------------|:--------|
| **Excepciones** (`try-catch`) | Errores inesperados, condiciones excepcionales | Fallo de DB, red |
| **Tipos Result** | Errores esperados, fallos de validación | Parsing, validación de formulario |
| **Option/Maybe** | Valores que pueden ser nulos | Búsquedas, lookups |
| **Códigos de Error** | Sistemas legacy, interop con C | FFI, low-level |

### 3. Aplicar Estrategia de Recuperación

Según el error y el contexto:

- **Retry con Backoff**: Timeouts, rate limits, errores transitorios
- **Circuit Breaker**: Servicios externos que fallan repetidamente
- **Graceful Degradation**: Fallback a caché, modo offline, o funcionalidad reducida
- **Fail Fast**: Validación de entrada, bugs de programación
- **Error Aggregation**: Validación de formularios (recolectar todos los errores)

---

## Patrones Rápidos por Lenguaje

### Python

#### Jerarquía de Excepciones Personalizada

```python
class ApplicationError(Exception):
    """Excepción base para todos los errores de la aplicación."""
    def __init__(self, message: str, code: str = None, details: dict = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}
        self.timestamp = datetime.utcnow()

class ValidationError(ApplicationError):
    """Validación fallida."""
    pass

class NotFoundError(ApplicationError):
    """Recurso no encontrado."""
    pass

# Uso
def get_user(user_id: str) -> User:
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise NotFoundError(
            f"Usuario no encontrado",
            code="USER_NOT_FOUND",
            details={"user_id": user_id}
        )
    return user
```

#### Reintento con Backoff Exponencial

```python
import time
from functools import wraps

def retry(max_attempts: int = 3, backoff_factor: float = 2.0, exceptions: tuple = (Exception,)):
    """Decorador de reintento con backoff exponencial."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        sleep_time = backoff_factor ** attempt
                        time.sleep(sleep_time)
                        continue
                    raise
            raise last_exception
        return wrapper
    return decorator

# Uso
@retry(max_attempts=3, exceptions=(NetworkError,))
def fetch_data(url: str) -> dict:
    response = requests.get(url, timeout=5)
    response.raise_for_status()
    return response.json()
```

#### Context Managers para Limpieza

```python
from contextlib import contextmanager

@contextmanager
def database_transaction(session):
    """Asegura commit o rollback automático."""
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

# Uso
with database_transaction(db.session) as session:
    user = User(name="Alice")
    session.add(user)
    # Commit o rollback automático
```

---

### TypeScript/JavaScript

#### Clases de Error Personalizadas

```typescript
class ApplicationError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends ApplicationError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'VALIDATION_ERROR', 400, details);
    }
}

// Uso
function getUser(id: string): User {
    const user = users.find(u => u.id === id);
    if (!user) {
        throw new NotFoundError('Usuario', id);
    }
    return user;
}
```

#### Patrón Result Type

```typescript
type Result<T, E = Error> =
    | { ok: true; value: T }
    | { ok: false; error: E };

function Ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

function Err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

// Uso
function parseJSON<T>(json: string): Result<T, SyntaxError> {
    try {
        const value = JSON.parse(json) as T;
        return Ok(value);
    } catch (error) {
        return Err(error as SyntaxError);
    }
}

// Consumir
const result = parseJSON<User>(userJson);
if (result.ok) {
    console.log(result.value.name);
} else {
    console.error('Fallo al parsear:', result.error.message);
}
```

#### Manejo de Errores Asíncronos

```typescript
async function fetchUserOrders(userId: string): Promise<Order[]> {
    try {
        const user = await getUser(userId);
        const orders = await getOrders(user.id);
        return orders;
    } catch (error) {
        if (error instanceof NotFoundError) {
            return [];  // Array vacío si no se encuentra
        }
        if (error instanceof NetworkError) {
            return retryFetchOrders(userId);  // Reintento
        }
        throw error;  // Re-lanzar inesperados
    }
}
```

---

### Rust

```rust
use std::fs::File;
use std::io::{self, Read};

// Result type para operaciones que pueden fallar
fn read_file(path: &str) -> Result<String, io::Error> {
    let mut file = File::open(path)?;  // ? propaga errores
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}

// Errores personalizados
#[derive(Debug)]
enum AppError {
    Io(io::Error),
    NotFound(String),
    Validation(String),
}

impl From<io::Error> for AppError {
    fn from(error: io::Error) -> Self {
        AppError::Io(error)
    }
}

// Combinando Option y Result
fn get_user_age(id: &str) -> Result<u32, AppError> {
    find_user(id)
        .ok_or_else(|| AppError::NotFound(id.to_string()))
        .map(|user| user.age)
}
```

---

### Go

```go
// Manejo básico
func getUser(id string) (*User, error) {
    user, err := db.QueryUser(id)
    if err != nil {
        return nil, fmt.Errorf("fallo al consultar usuario: %w", err)
    }
    if user == nil {
        return nil, errors.New("usuario no encontrado")
    }
    return user, nil
}

// Errores sentinela (sentinel errors)
var (
    ErrNotFound     = errors.New("no encontrado")
    ErrUnauthorized = errors.New("no autorizado")
)

// Verificación
user, err := getUser("123")
if err != nil {
    if errors.Is(err, ErrNotFound) {
        // Manejar no encontrado
    } else {
        // Otros errores
    }
}
```

---

## Patrones Universales

### Circuit Breaker (Cortocircuito)

Evita fallos en cascada. Si un servicio falla repetidamente, deja de llamarlo temporalmente.

**Estados**:

- **CLOSED** (Cerrado): Normal, permite peticiones
- **OPEN** (Abierto): Fallando, rechaza peticiones
- **HALF_OPEN** (Semi-abierto): Probando si se recuperó

**Lógica**:

1. Cuenta fallos consecutivos
2. Si supera threshold → OPEN (rechaza peticiones)
3. Después de timeout → HALF_OPEN (permite 1 petición de prueba)
4. Si prueba pasa → CLOSED, sino → OPEN de nuevo

### Graceful Degradation (Degradación Elegante)

Provee funcionalidad de respaldo cuando ocurren errores.

```python
def get_user_profile(user_id: str) -> UserProfile:
    try:
        return fetch_from_cache(user_id)  # Primero caché
    except CacheError:
        try:
            return fetch_from_database(user_id)  # Fallback a DB
        except DatabaseError:
            return get_default_profile()  # Último recurso
```

### Error Aggregation (Agregación de Errores)

Recolecta múltiples errores en lugar de fallar en el primero (formularios).

```typescript
const errors: ValidationError[] = [];

if (!email.isValid()) errors.push(new ValidationError('Email inválido'));
if (!password.isValid()) errors.push(new ValidationError('Password débil'));

if (errors.length > 0) {
    throw new AggregateError(errors);
}
```

---

## Mejores Prácticas (Best Practices)

### ✅ Hacer

1. **Fail Fast**: Valida entradas al principio

   ```python
   def process_user(user_id: str):
       if not user_id:
           raise ValueError("user_id es requerido")
       # ... resto de la lógica
   ```

2. **Preserva el Contexto**: Stack traces, metadatos, timestamps

   ```python
   raise NotFoundError(
       "Usuario no encontrado",
       code="USER_NOT_FOUND",
       details={"user_id": user_id, "timestamp": datetime.utcnow()}
   )
   ```

3. **Mensajes Significativos**: Explica qué pasó y cómo arreglarlo

   ```
   ❌ "Error"
   ✅ "Usuario no encontrado (ID: 123). Verifica que el ID sea correcto."
   ```

4. **Loguea Apropiadamente**: Error real = log; fallo esperado = no spam

   ```python
   try:
       user = get_user(user_id)
   except NotFoundError:
       # Fallo esperado, no loguear como ERROR
       return None
   except DatabaseError as e:
       # Error real, loguear
       logger.error(f"DB error: {e}", exc_info=True)
       raise
   ```

5. **Limpia Recursos**: `try-finally`, context managers, defer

   ```python
   file = open('data.txt')
   try:
       data = file.read()
   finally:
       file.close()  # Siempre cierra
   ```

### ❌ No Hacer

1. **Catching Too Broadly**: `except Exception` esconde bugs reales

   ```python
   # ❌ Muy amplio
   try:
       process_data()
   except Exception:
       pass  # ¿Qué error? Imposible saber
   
   # ✅ Específico
   try:
       process_data()
   except (NetworkError, TimeoutError) as e:
       logger.warning(f"Error de red: {e}")
   ```

2. **Empty Catch Blocks**: Silenciar errores hace imposible el debugging

   ```python
   # ❌ Silenciar
   try:
       risky_operation()
   except:
       pass
   
   # ✅ Loguear o relanzar
   try:
       risky_operation()
   except Exception as e:
       logger.error(f"Operación falló: {e}")
       raise
   ```

3. **Logging and Re-throwing**: Crea entradas duplicadas

   ```python
   # ❌ Log + re-throw = duplicados
   try:
       do_something()
   except Exception as e:
       logger.error(f"Error: {e}")
       raise  # Se logueará de nuevo arriba
   
   # ✅ Solo re-throw (loguea en un solo lugar)
   try:
       do_something()
   except Exception:
       raise  # Se loguea en el nivel superior
   ```

4. **No Limpiar**: Olvidar cerrar archivos/conexiones
5. **Códigos de Error**: Evita `-1` o `false`; usa Excepciones o Result types

---

## Checklist de Implementación

Cuando implementes manejo de errores, verifica:

- [ ] ¿Identifiqué si el error es recuperable o irrecuperable?
- [ ] ¿Elegí la filosofía correcta (Excepciones vs Result vs Option)?
- [ ] ¿Apliqué la estrategia de recuperación apropiada (retry, circuit breaker, degradation)?
- [ ] ¿El mensaje de error es claro y accionable?
- [ ] ¿Preservé el contexto (stack trace, metadatos, timestamp)?
- [ ] ¿Logueo solo errores reales (no fallos esperados)?
- [ ] ¿Limpio recursos correctamente (files, connections, locks)?
- [ ] ¿Evito catch vacíos o demasiado amplios?
- [ ] ¿No logueo y re-lanzo (duplicados)?
- [ ] ¿Los tests cubren casos de error?

---

## Antipatrones Comunes

❌ **Swallowing Errors** (Tragarse errores):

```python
try:
    critical_operation()
except:
    pass  # ❌ Error desaparece, imposible debuggear
```

❌ **Pokemon Exception Handling** (Catch 'em all):

```python
try:
    do_stuff()
except Exception:  # ❌ Captura TODO, incluido KeyboardInterrupt
    handle_error()
```

❌ **Returning Error Codes**:

```python
def get_user(id):
    if not found:
        return -1  # ❌ Ambiguo, fácil de ignorar
```

✅ **Hacer**:

```python
# ✅ Excepciones específicas
try:
    critical_operation()
except NetworkError as e:
    logger.error(f"Error de red: {e}")
    retry_with_backoff()

# ✅ Result type
def get_user(id: str) -> Result[User, NotFoundError]:
    ...
```

---

## Recursos Adicionales

Para patrones más avanzados, consulta:
- **Circuit Breaker completo**: [resources/circuit-breaker-pattern.md](resources/circuit-breaker-pattern.md)
- **Jerarquía de excepciones**: [resources/exception-hierarchy.md](resources/exception-hierarchy.md)
- **Guía de mensajes de error**: [resources/error-messages-guide.md](resources/error-messages-guide.md)

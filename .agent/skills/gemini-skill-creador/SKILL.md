---
name: gemini-skill-creador
description: Genera Skills (Habilidades) de alta calidad para el entorno de agentes Antigravity. Úsese cuando el usuario solicite crear una nueva skill, habilidad personalizada, o necesite un marco de referencia para estructurar capacidades extendidas del agente.
---

# Gemini Skill Creador

Eres un desarrollador experto especializado en crear "Skills" (Habilidades) para el entorno de agentes Antigravity. Tu objetivo es generar directorios `.agent/skills/` de alta calidad, predecibles y eficientes basados en los requerimientos del usuario.

## Cuándo usar esta skill

- El usuario solicita crear una nueva skill o habilidad personalizada
- Se necesita extender las capacidades del agente con funcionalidad especializada
- Se requiere un marco de referencia para estructurar nuevas habilidades
- El usuario menciona "crear skill", "nueva habilidad", "capacidad personalizada" o términos similares

## 1. Requisitos Estructurales Principales

Cada skill que generes debe seguir estrictamente esta jerarquía de carpetas:

```
/                           (Raíz del directorio de la skill)
├── SKILL.md               (Obligatorio: Lógica principal e instrucciones)
├── scripts/               (Opcional: Scripts de ayuda o automatización)
├── examples/              (Opcional: Implementaciones de referencia)
└── resources/             (Opcional: Plantillas o activos)
```

## 2. Estándares del Frontmatter (YAML)

El archivo `SKILL.md` debe comenzar con un encabezado YAML (frontmatter) siguiendo estas reglas estrictas:

- **name**: Usar formato **Infinitivo** (ej. `probar-codigo`, `gestionar-bases-datos`). Máximo 64 caracteres. Solo minúsculas, números y guiones. No uses nombres de marcas (como "claude" o "anthropic") en el nombre.
- **description**: Escrita en **tercera persona**. Debe incluir disparadores (keywords) específicos. Máximo 1024 caracteres. (ej. "Extrae texto de archivos PDF. Úsese cuando el usuario mencione procesamiento de documentos o archivos PDF.").

### Ejemplo de frontmatter válido:

```yaml
---
name: procesar-documentos-pdf
description: Extrae texto de archivos PDF y los procesa para análisis. Úsese cuando el usuario mencione procesamiento de documentos PDF, extracción de texto de PDFs, o análisis de contenido en archivos PDF.
---
```

## 3. Principios de Redacción (Estilo Directo)

Al escribir el cuerpo de `SKILL.md`, adhiérete a estas mejores prácticas:

* **Concisión**: Asume que el agente es inteligente. No expliques qué es un PDF o un repositorio Git. Céntrate solo en la lógica única de la skill.
* **Divulgación Progresiva**: Mantén el archivo `SKILL.md` por debajo de las 500 líneas. Si se necesita más detalle, enlaza a archivos secundarios (ej. `[Ver AVANZADO.md](AVANZADO.md)`) profundizando solo un nivel.
* **Barras de Ruta**: Usa siempre barras normales `/` para las rutas, nunca invertidas `\`.
* **Grados de Libertad**: 
    - Usa **Viñetas (Bullet Points)** para tareas de alta libertad (heurística/criterio).
    - Usa **Bloques de Código** para libertad media (plantillas a rellenar).
    - Usa **Comandos Bash Específicos** para libertad baja (operaciones frágiles).

### Ejemplo de grados de libertad:

**Alta libertad (Viñetas):**
```markdown
- Analiza el código fuente para identificar patrones de diseño
- Evalúa la complejidad ciclomática de las funciones críticas
- Sugiere refactorizaciones basadas en principios SOLID
```

**Libertad media (Plantillas):**
```markdown
// Template para crear un endpoint REST
export async function handle[Action](req: Request): Promise<Response> {
  // 1. Validar entrada
  // 2. Ejecutar lógica de negocio
  // 3. Retornar respuesta
}
```

**Baja libertad (Comandos específicos):**
```bash
# Ejecutar análisis estático
npm run lint -- --fix
npm run type-check
```

## 4. Flujo de Trabajo y Bucles de Retroalimentación

Para tareas complejas, incluye:

1.  **Listas de Verificación (Checklists)**: Una lista en markdown que el agente pueda copiar y actualizar para rastrear el estado.

```markdown
## Checklist de implementación

- [ ] Crear estructura de carpetas
- [ ] Implementar lógica core
- [ ] Añadir tests unitarios
- [ ] Validar integración
- [ ] Documentar API pública
```

2.  **Bucles de Validación**: Un patrón de "Planificar-Validar-Ejecutar".

```markdown
## Flujo de validación

1. **Planificar**: Revisar requerimientos y diseñar solución
2. **Validar**: Ejecutar `npm run validate` para verificar configuración
3. **Ejecutar**: Implementar cambios
4. **Re-validar**: Ejecutar tests para confirmar corrección
```

3.  **Gestión de Errores**: Las instrucciones para los scripts deben ser "cajas negras": dile al agente que ejecute `--help` si tiene dudas.

```markdown
## Uso de scripts

Si tienes dudas sobre los parámetros de un script, ejecuta:
```bash
node scripts/[nombre-script].js --help
```
```

## 5. Plantilla de Salida

Cuando se te pida crear una skill, presenta el resultado en este formato:

### Estructura de carpetas
**Ruta:** `.agent/skills/[nombre-de-skill]/`

```
/nombre-de-skill/
├── SKILL.md
├── scripts/
│   └── [script-helper].js
├── examples/
│   └── [ejemplo-uso].md
└── resources/
    └── [plantilla-o-activo]
```

### Contenido de SKILL.md

```markdown
---
name: [nombre-en-infinitivo]
description: [descripción en 3ª persona con disparadores]
---

# [Título de la Skill]

## Cuándo usar esta skill
- [Disparador 1: keywords y contextos específicos]
- [Disparador 2: casos de uso típicos]

## Flujo de trabajo
[Insertar checklist o guía paso a paso aquí]

## Instrucciones
[Lógica específica, fragmentos de código o reglas]

## Recursos
- [Enlace a scripts/ o resources/ si aplica]
```

### Archivos de Soporte (Si aplica)

Si la skill requiere scripts, ejemplos o recursos adicionales, proporciona el contenido completo para cada archivo en la estructura correspondiente.

**Ejemplo de script helper:**
```javascript
// scripts/helper.js
module.exports = {
  execute: async (params) => {
    // Lógica del script
  }
};
```

**Ejemplo de referencia:**
```markdown
// examples/uso-basico.md
# Uso Básico

## Paso 1: Preparación
...
```

## Checklist de Creación de Skills

Cuando crees una nueva skill, verifica:

- [ ] El nombre está en infinitivo, minúsculas y guiones
- [ ] La descripción incluye disparadores claros en tercera persona
- [ ] El frontmatter YAML es válido
- [ ] El contenido de SKILL.md es conciso (< 500 líneas)
- [ ] Se usan rutas con barras normales `/`
- [ ] Los grados de libertad son apropiados (viñetas/código/bash)
- [ ] Se incluyen checklists para tareas complejas
- [ ] Los scripts tienen instrucciones de uso (`--help`)
- [ ] La estructura de carpetas es correcta

## Recursos

Esta skill es autodocumentada. Para crear nuevas skills, sigue exactamente este patrón como referencia.

---
name: brand-identity
description: Proporciona la fuente única de verdad para las directrices de marca de 'Repaart' con estilo 'Antigravity'. Úsese cuando el usuario solicite generar componentes UI premium, implementar glassmorphism, o diseños que requieran adherencia al estilo futurista y sofisticado de Repaart.
---

# Brand Identity & Guidelines

**Brand Name:** Repaart  
**Design Style:** Antigravity (Premium Futuristic Weightless UI)

Esta skill define las restricciones fundamentales para el diseño visual y la implementación técnica de la marca. Debes adherirte estrictamente a estas directrices para mantener la consistencia.

## Cuándo usar esta skill

- El usuario solicita crear componentes UI premium para Repaart
- Se necesita implementar el estilo "Antigravity" con efectos de levitación
- Se requiere glassmorphism (vidrio esmerilado translúcido) en containers
- Se solicita diseño futurista, sofisticado, o "flotante"
- El usuario menciona "Repaart", "Antigravity", "glassmorphism", "floating UI", "premium design", "brand guidelines", "identidad de marca", "design tokens", o "tech stack"
- Se necesita generar copy/texto con tono premium y sofisticado

## Documentación de Referencia

Dependiendo de la tarea que estés realizando, consulta los archivos de recursos específicos a continuación. No adivines elementos de marca; siempre lee el archivo correspondiente.

### Para Diseño Visual & Estilos UI

Si necesitas colores exactos, fuentes, border radii, o valores de espaciado, lee:
👉 **[`resources/design-tokens.json`](resources/design-tokens.json)**

### Para Codificación & Implementación de Componentes

Si estás generando código, eligiendo librerías, o estructurando componentes UI, lee las restricciones técnicas aquí:
👉 **[`resources/tech-stack.md`](resources/tech-stack.md)**

### Para Copywriting & Generación de Contenido

Si estás escribiendo copy de marketing, mensajes de error, documentación, o texto de cara al usuario, lee las directrices de personalidad aquí:
👉 **[`resources/voice-tone.md`](resources/voice-tone.md)**

## Flujo de Trabajo

Cuando trabajes con esta marca, sigue este proceso:

1. **Identificar el tipo de tarea**:
   - [ ] ¿Es diseño/UI? → Leer `design-tokens.json`
   - [ ] ¿Es implementación/código? → Leer `tech-stack.md`
   - [ ] ¿Es copywriting/contenido? → Leer `voice-tone.md`

2. **Consultar el recurso apropiado**:
   - [ ] Abrir el archivo de recursos correspondiente
   - [ ] Extraer los tokens/reglas aplicables

3. **Aplicar las directrices**:
   - [ ] Usar exactamente los valores definidos (colores, fuentes, etc.)
   - [ ] Seguir los patrones obligatorios (ej. `rounded-2xl` para botones)
   - [ ] Verificar que no uses patrones prohibidos

4. **Validar consistencia**:
   - [ ] Revisar que el resultado es coherente con la identidad de marca
   - [ ] Confirmar adherencia a las restricciones técnicas

## Principios Fundamentales del Estilo Antigravity

### Filosofía Central: Ingravidez

- **Concepto**: La interfaz debe sentirse como si estuviera flotando en un entorno de gravedad cero
- **Inspiración**: Calidad premium Apple, pero más etéreo y futurista
- **Estética**: Limpieza extrema, espacio blanco generoso, sofisticación tecnológica

### Glassmorphism Premium (OBLIGATORIO)

- **TODOS** los containers, cards, sidebars y elementos de navegación son de "vidrio esmerilado" translúcido
- **SIEMPRE** usa `backdrop-blur-xl` para crear refracción del fondo
- **SIEMPRE** usa backgrounds translúcidos (`bg-white/70`) con bordes sutiles
- **NUNCA** uses containers sólidos y opacos

### Efecto de Levitación (CRÍTICO)

- **TODOS** los elementos deben tener sombras profundas, suaves y difusas
- **Ningún** elemento debe parecer pegado al fondo
- **SIEMPRE** crea la ilusión óptica de que los elementos flotan físicamente sobre la pantalla
- **Profundidad**: La UI se construye en múltiples capas de vidrio flotante

### Contraste Tipográfico Dramático

- **Títulos y Datos Numéricos**: BOLD/SEMIBOLD (600-700) en Deep Slate Blue
- **Cuerpo y Etiquetas**: LIGHT/REGULAR (300-400) en gris medio
- **NO** uses solo letras finas; el contraste de pesos es ESENCIAL
- **Fuente**: Sans Serif Geométrica Moderna (Inter, SF Pro, Satoshi)

### Implementación Técnica

- **OBLIGATORIO**: React + TypeScript + Tailwind CSS
- **PROHIBIDO**: jQuery, Bootstrap, esquinas cuadradas, containers sólidos, diseños planos
- **PREFERIDO**: shadcn/ui como base (customizado con tokens Antigravity), Lucide React para iconos

### Bordes y Formas

- **SIEMPRE** usa esquinas extremadamente redondeadas (`rounded-2xl`, `rounded-3xl`, `rounded-full`)
- **NUNCA** uses esquinas duras o cuadradas
- **Botones**: Forma de píldora (`rounded-full`)
- **Cards**: Radios grandes (`rounded-2xl` o `rounded-3xl`)

### Colores

- **Primario**: Deep Slate Blue (#1e293b) para títulos
- **Acento**: Gradiente vibrante Electric Blue → Purple (#3b82f6 → #8b5cf6) para interacciones
- **Fondos**: Gris muy pálido casi blanco (#f8fafc)
- **SIEMPRE** usa los design tokens definidos en `design-tokens.json`

## Recursos

Esta skill incluye tres archivos de recursos críticos:

- **[design-tokens.json](resources/design-tokens.json)**: Tokens de diseño (colores, tipografía, UI)
- **[tech-stack.md](resources/tech-stack.md)**: Stack técnico y reglas de implementación
- **[voice-tone.md](resources/voice-tone.md)**: Guías de voz, tono y copywriting

## Checklist de Validación Antigravity

Antes de entregar cualquier trabajo relacionado con Repaart, verifica:

### Glassmorphism & Material

- [ ] Todos los containers usan glassmorphism (`bg-white/70 backdrop-blur-xl border-white/30`)
- [ ] NO hay containers sólidos u opacos
- [ ] Todos los elementos tienen fondo translúcido con backdrop blur

### Efecto de Levitación

- [ ] Todos los elementos tienen sombras profundas y suaves
- [ ] Las sombras crean la ilusión de flotación física
- [ ] Los elementos NO parecen pegados al fondo
- [ ] Se usa jerarquía de sombras correcta (light/medium/deep según elemento)

### Tipografía

- [ ] Los títulos son BOLD o SEMIBOLD (600-700) en Deep Slate Blue
- [ ] El cuerpo/labels son LIGHT o REGULAR (300-400) en gris medio
- [ ] Hay contraste dramático de pesos (NO solo letras finas)
- [ ] La fuente es Inter, SF Pro o Satoshi

### Colores

- [ ] Los colores usados están en `design-tokens.json`
- [ ] Primario es Deep Slate Blue (#1e293b)
- [ ] Accents usan gradiente Electric Blue → Purple
- [ ] Fondos son gris muy pálido (#f8fafc)

### Formas & Bordes

- [ ] Todos los border radios son grandes (`rounded-2xl`, `rounded-3xl`, `rounded-full`)
- [ ] NO hay esquinas cuadradas (`rounded-none`)
- [ ] Botones son píldoras (`rounded-full`)

### Implementación

- [ ] El código usa React + TypeScript + Tailwind CSS
- [ ] Los componentes son shadcn/ui customizados con tokens Antigravity
- [ ] Los iconos son de Lucide React (thin, rounded lines)
- [ ] NO se usa jQuery, Bootstrap, o patrones planos

### Estética General

- [ ] La UI se siente "flotante" y en gravedad cero
- [ ] Hay espacio blanco generoso
- [ ] El diseño es premium, sofisticado y futurista
- [ ] Se perciben múltiples capas de vidrio flotante

## Errores Comunes a Evitar (Anti-Antigravity)

❌ **NUNCA HACER** (Viola el estilo Antigravity):

- Usar containers sólidos y opacos (todos deben ser glassmorphism)
- Crear elementos sin sombras o con sombras planas (todo debe flotar)
- Usar solo tipografía fina sin contraste de pesos (necesitas bold para títulos)
- Usar esquinas cuadradas o poco redondeadas (`rounded-none`, `rounded`)
- Usar colores que no están en `design-tokens.json`
- Crear diseños "planos" o "pegados" al fondo
- Usar jQuery, Bootstrap, o componentes genéricos sin customizar
- Olvidar el backdrop blur en containers
- Usar fuentes del sistema por defecto

❌ **Ejemplos de código INCORRECTO**:

```tsx
// ❌ Container sólido opaco (NO Antigravity)
<div className="bg-white border rounded p-4">

// ❌ Sin sombra de flotación
<div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6">

// ❌ Tipografía sin contraste (todo thin)
<h1 className="text-2xl font-light">Title</h1>
<p className="text-sm font-light">Body text</p>

// ❌ Botón con esquinas duras
<button className="bg-blue-500 rounded px-4 py-2">
```

✅ **SIEMPRE HACER** (Antigravity correcto):

- Usar glassmorphism en TODOS los containers (`bg-white/70 backdrop-blur-xl border-white/30`)
- Aplicar sombras profundas y suaves a TODOS los elementos
- Crear contraste dramático: títulos BOLD en Deep Slate Blue, cuerpo LIGHT en gris
- Usar esquinas extremadamente redondeadas (`rounded-2xl`, `rounded-3xl`, `rounded-full`)
- Seguir los design tokens de `design-tokens.json` exactamente
- Construir UI en capas de vidrio flotante con profundidad
- Customizar shadcn/ui con tokens Antigravity
- Mantener espacio blanco generoso
- Usar fuente geométrica moderna (Inter, SF Pro, Satoshi)

✅ **Ejemplos de código CORRECTO**:

```tsx
// ✅ Glass container con floating shadow (Antigravity perfecto)
<div className="bg-white/70 backdrop-blur-xl border border-white/30 rounded-2xl p-8 shadow-[0_12px_48px_rgba(30,41,59,0.12)]">

// ✅ Contraste tipográfico dramático
<h1 className="text-3xl font-bold text-slate-800">Premium Title</h1>
<p className="text-sm font-light text-slate-500">Light body text for air</p>

// ✅ Botón con gradiente, pill shape y floating shadow
<button className="px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold shadow-[0_8px_32px_rgba(30,41,59,0.08)] hover:shadow-xl hover:scale-105 transition-all">
  Action
</button>
```

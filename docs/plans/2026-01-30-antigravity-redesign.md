# Plan de Implementación: Global Antigravity Redesign

**Fecha**: 2026-01-30
**Basado en**: `resources/design-tokens.json` y `resources/brand-identity/SKILL.md`

> [!NOTE]
> **Para el implementador**: Sigue este plan tarea por tarea. Cada step es <= 5 minutos.
> Usa DRY, YAGNI, TDD. Commit frecuente.

## Objetivo

Unificar la identidad visual de la aplicación bajo el sistema de diseño "Antigravity" (Glassmorphism, Levitación, SnowUI), asegurando que todas las vistas principales (Login, Dashboard, Clientes, Wallet) compartan la misma estética premium que el Simulator.

## Arquitectura

- **Global Styles**: Actualizar `globals.css` y `tailwind.config.ts` con los nuevos tokens.
- **Layouts**: Refactorizar `DashboardLayout` para incluir el fondo orgánico y glassmorphism.
- **Componentes Base**: Crear/Actualizar componentes atómicos (Button, Card, Input) con estilos Antigravity.
- **Vistas**: Aplicar componentes base a las páginas existentes.

## Tech Stack

- Tailwind CSS
- Framer Motion
- Lucide React

---

## Estructura de Tareas

### Tarea 1: Configuración de Tokens Globales

**Archivos**:

- Modificar: `tailwind.config.ts`
- Modificar: `src/app/globals.css`

---

#### Step 1: Actualizar Tailwind Config

**Descripción**: Extender la configuración de Tailwind con colores y sombras del sistema Antigravity.
**Razón**: Centralizar los valores "mágicos" para evitar hardcoding.

#### Step 2: Definir CSS Variables

**Descripción**: Añadir variables CSS para los colores semánticos en `globals.css`.

#### Step 3: Commit

**Comando**: `git commit -m "chore: update design tokens implementation"`

---

### Tarea 2: Componentes Base (Atomos)

**Archivos**:

- Modificar: `src/components/ui/button.tsx`
- Modificar: `src/components/ui/card.tsx`
- Modificar: `src/components/ui/input.tsx`

---

#### Step 1: Refactor Button

**Descripción**: Actualizar estilos de botón para usar `rounded-full` y sombras de levitación.

#### Step 2: Refactor Card

**Descripción**: Aplicar `backdrop-blur-xl`, `bg-white/70` y bordes sutiles a las tarjetas.

#### Step 3: Commit

**Comando**: `git commit -m "feat: update base components to antigravity style"`

---

### Tarea 3: Dashboard Layout y Navegación

**Archivos**:

- Modificar: `src/features/crm/components/DashboardSidebar.tsx`
- Modificar: `src/app/dashboard/layout.tsx`

---

#### Step 1: Glass Sidebar

**Descripción**: Convertir la sidebar en un panel de vidrio flotante.

#### Step 2: Fondo Global

**Descripción**: Asegurar que el `DashboardLayout` tenga el `gradient-organic` de fondo.

#### Step 3: Commit

**Comando**: `git commit -m "feat: apply antigravity layout"`

---

### Tarea 4: Vista de Clientes (Tabla)

**Archivos**:

- Modificar: `src/features/crm/components/ClientList.tsx` (o equivalente)

---

#### Step 1: Tabla Glassmorphism

**Descripción**: Estilizar la tabla de clientes como un panel flotante.

#### Step 2: Verify

**Descripción**: Verificar que la legibilidad se mantiene sobre el fondo difuso.

#### Step 3: Commit

**Comando**: `git commit -m "feat: redesign client list"`

---

### Tarea 5: Login Screen

**Archivos**:

- Modificar: `src/app/page.tsx` (o login page)

---

#### Step 1: Hero Section

**Descripción**: Actualizar la página de login para ser la "cara" de la marca Antigravity.

#### Step 2: Commit

**Comando**: `git commit -m "feat: redesign login page"`

---

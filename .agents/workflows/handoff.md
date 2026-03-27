---
description: Handoff protocol for multi-agent synchronization (Antigravity <> Opencode) Enterprise
---

# /handoff — Protocolo de Delegación Autónoma a OpenCode

Este workflow define **cuándo** y **cómo** Antigravity debe delegar la creación o refactorización de código pesado a una instancia de OpenCode en background, usando aislamiento radical.

## 🟢 CONDICIONES DE ACTIVACIÓN (Trigger)

Antigravity **DEBE** activar este workflow automáticamente si se cumplen 3 de estas 4 condiciones:

1. **Volumen Predecible / Boilerplate**: Escribir mucho código repetitivo.
2. **Arquitectura Finalizada**: Decisiones de diseño tomadas.
3. **Aislamiento Funcional**: Código a modificar es modular e independiente.
4. **Cero Ambigüedad Lógica**: Lógica de negocio estándar.

Si se cumplen, **NO ESCRIBAS EL CÓDIGO TÚ MISMO**. Procede al Handoff.

---

## 🚀 PASO 1: Aislamiento Radical (Git Worktrees)

Antigravity asume el control e informa al usuario. Acto seguido, en lugar de lanzar OpenCode en el directorio principal, DEBE aislar el proceso:

1. Elige un ID corto para la tarea (ej. `feat-login-ui`).
2. Obtén la rama actual. Si no hay rama, crea una.
3. Crea un worktree oculto fuera de la raíz (o en una carpeta `.worktrees/`):
   `git worktree add ../.worktrees/<id-tarea> -b <id-tarea>`
4. **[NUEVO] Fast Worktree Spin-up:** Para optimizar la instalación de dependencias en el aislamiento y evitar latencias, ejecuta `npm install --prefer-offline --no-audit` (o equivalente) DENTRO de la carpeta del worktree ANTES de iniciar al worker.
5. El worker ejecutará sus comandos EXCLUSIVAMENTE dentro de ese worktree aislado.

---

## 🧠 PASO 2: Generación del Prompt de Handoff (Memory & Context)

Antigravity crea un prompt blindado para OpenCode. Debe incluir imperativamente:

- La tarea exacta y los archivos a modificar.
- **Memoria Muscular Compartida:** Inyectar el flag `--context .agents/architecture.md` para que conozca el stack y reglas absolutas del proyecto.
- **Inyección Dinámica de Contexto:** Añadir Skills relevantes.
- **Auto-Curación Obligatoria (Closed-Loop Testing):** Instruir a OpenCode a autocorregirse usando linters de forma iterativa.
- **[NUEVO] Regla Anti-Infinity Loop:** Añade el aviso explícito: *"Si un validador (linter/test runner) lanza un error de excepción de motor/stack interno y NO un error de código, ABORTA el fix, prioriza TypeScript, y devuelve la advertencia de 'tooling fallido' para no atascarte en un bucle infinitamente."*

---

## ⚙️ PASO 3: Ejecución en Background (Fleet System)

Antigravity lanza el comando de OpenCode en el background en el directorio del worktree. 

**Regla de Parallel Dispatching:** Lanza máximo 2 o 3 instancias simultáneas (Resource Cap).

// turbo

```bash
cd ../.worktrees/<id-tarea>
mkdir -p .agents/logs/
opencode "Implementa [tarea]. AUTO-CURACIÓN: Lanza [comando test/lint], analiza salida y arréglalo tú mismo. PROHIBIDO fallar. LEYES: [leyes]. VERIFICA." --context .agents/architecture.md > .agents/logs/opencode_handoff_$(date +%s).log 2>&1
```

---

## 🔄 PASO 4: Seguimiento y Revisión en Dos Fases (Subagent Review)

El usuario puede ver el estado en tiempo real gracias al **Monitor de Flota**:
Ejecutando `powershell .agents/scripts/fleet-monitor.ps1`

Cuando OpenCode termina en su worktree:
1. **Fase 1 (Spec Compliance):** Antigravity revisa el Diff del worktree.
2. **Fase 2 (Code Quality):** ¿Pasan los tests localmente en el worktree?
3. **Merge & Destroy:** Si supera ambas fases, Antigravity hace checkout a la rama principal, hace `git merge <id-tarea>`, y elimina el worktree:
   ```bash
   git worktree remove ../.worktrees/<id-tarea>
   git branch -D <id-tarea>
   ```
   E inicializa el workflow `/commit` (que incluirá a Ollama para documentarlo).

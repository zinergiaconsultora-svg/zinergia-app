---
description: Workflow de commit seguro - Solo commitea código verificado y aprobado por el usuario
---

# /commit — Commit Seguro

Workflow obligatorio antes de hacer cualquier commit. **Nunca** hagas `git commit` sin pasar por estos pasos.

---

## Paso 0: Verificar que hay cambios

// turbo

```bash
git status --short
```

- Si no hay cambios → informa al usuario y **STOP**.
- Si hay cambios → continúa.

---

## Paso 1: Verificar que no hay errores de TypeScript

// turbo

```bash
npx tsc --noEmit 
```

- Si hay errores → **STOP**. Corrige antes de continuar.
- Si pasa limpio → continúa.

---

## Paso 2: Verificar lint (solo archivos cambiados)

// turbo

```bash
git diff --name-only --diff-filter=ACMR HEAD -- '*.ts' '*.tsx' | xargs -r npx eslint --max-warnings=0 
```

Si no hay archivos .ts/.tsx cambiados, salta este paso.

- Si hay errores → **STOP**. Corrige antes de continuar.
- Si pasa limpio → continúa.

---

## Paso 3: Ejecutar tests unitarios

// turbo

```bash
npm run test 
```

- Si hay tests fallidos → **STOP**. Corrige antes de continuar.
- Si todos pasan → continúa.

---

## Paso 4 (OPCIONAL): Verificar build

**Solo ejecutar si:**

- El commit va a `main`
- El usuario lo pide explícitamente
- Los cambios tocan configuración (`next.config`, `tsconfig`, `package.json`)

// turbo

```bash
npm run build 
```

- Si falla → **STOP**. Corrige antes de continuar.
- Si compila → continúa.

---

## Paso 5: Mostrar resumen detallado al usuario

// turbo

```bash
git diff --stat && echo "" && echo "=== ARCHIVOS SIN TRACKEAR ===" && git ls-files --others --exclude-standard
```

Presenta al usuario:

- Archivos modificados con líneas +/-
- Archivos nuevos sin trackear (podrían ser basura: logs, .env, etc.)
- Archivos eliminados

---

## Paso 5.5: Generación Inteligente de Mensaje (Ollama Local)

// turbo

```bash
git diff | ollama run qwen2.5:latest "INSTRUCCIÓN CRÍTICA: Eres una máquina extractora. Analiza el git diff y genera un ÚNICO mensaje de commit en formato Conventional Commits (feat:, fix:, refactor:, etc.). REGLAS ABSOLUTAS: 1) CERO explicaciones. 2) CERO saludos. 3) CERO bloques de código markdown (\`\`\`). Tu OUTPUT DEBE SER UNA SOLA LÍNEA EXACTA que será empaquetada en el comando 'git commit -m'. Si escribes 'Claro, aquí tienes', el sistema explotará." | Select-String -Pattern "\S" | Select-Object -ExpandProperty Line | Select-Object -Last 1
```

Esto generará una sugerencia de mensaje de commit hyper-precisa basada en el código cambiado, coste cero y sin latencia aprovechando la IA local. El comando incluye un "filtro antialucinación" (grep/tail) en conjunto con un prompt coercitivo para extirpar la "cháchara" del LLM.

---

## Paso 6: Pedir aprobación al usuario

Usa `notify_user` con **BlockedOnUser = true** para presentar:

1. **Resultado de verificaciones**:
   - ✅/❌ TypeCheck
   - ✅/❌ Lint
   - ✅/❌ Tests
   - ⏭️/✅/❌ Build (si se ejecutó)

2. **Archivos a incluir en el commit** — lista explícita. Pregunta si hay alguno que deba excluirse.

3. **Mensaje de commit sugerido** — formato conventional commits:
   - `feat(modulo): descripción` → nueva funcionalidad
   - `fix(modulo): descripción` → corrección de bug
   - `refactor(modulo): descripción` → reestructuración sin cambio funcional
   - `chore: descripción` → mantenimiento, deps, config
   - `docs: descripción` → solo documentación
   - `style: descripción` → formateo, sin cambio lógico

**Pregunta explícita**: "¿Apruebas este commit? ¿Quieres excluir algún archivo o cambiar el mensaje?"

**No continúes sin respuesta afirmativa.**

---

## Paso 7: Staging selectivo y commit

Añade **solo** los archivos aprobados por el usuario:

```bash
git add <archivos aprobados>
git commit -m "<mensaje aprobado>"
```

**No uses `git add -A`** salvo que el usuario lo apruebe explícitamente tras revisar la lista de archivos.

---

## Paso 8: Push (solo bajo petición explícita)

```bash
git push origin <rama-actual>
```

**Nunca** hagas push automáticamente. Solo si el usuario lo pide.

---

## Reglas inquebrantables

1. **Si alguna verificación falla → STOP.** Reporta el error exacto y propón corrección.
2. **Sin aprobación del usuario → no hay commit.** Jamás.
3. **Sin petición explícita → no hay push.** Jamás.
4. **No incluyas archivos basura.** Revisa que no entren logs (`.log`, `.txt` de debug), `.env*`, o archivos temporales.
5. **Si el `.gitignore` no cubre un archivo basura** → sugiere añadirlo al `.gitignore` antes del commit.

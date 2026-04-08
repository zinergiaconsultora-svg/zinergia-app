# Plan de Implementación — Correcciones Auditoría OCR Simulator

**Fecha:** 2026-04-08
**Rama:** main
**Scope:** Correcciones post-auditoría del flujo de confirmación OCR (Phase 2)

---

## Contexto y Dependencias

```
ocr-confirm.ts (server action)
    ↑ llamado por
useSimulator.ts (hook, confirmOcrData)
    ↑ expuesto via
SimulatorContext.tsx (context thin wrapper)
    ↑ consumido por
SimulatorView.tsx (plumbing de props)
    ↓ pasa props a
SimulatorForm.tsx (UI — localConfirmed bug aquí)
```

Las correcciones van de abajo a arriba: primero el server action, luego el hook, luego el componente UI.

---

## Fase 1 — Server Action: `ocr-confirm.ts`

### Tarea 1.1 — Corregir `corrected_fields` cuando no existe ejemplo previo

**Archivo:** `src/app/actions/ocr-confirm.ts`

**Problema exacto:**

Cuando no existe un `ocr_training_examples` para ese `jobId`, el código hace:

```ts
const originalFields = (existing?.extracted_fields ?? {}) as Record<string, unknown>;
```

`originalFields` queda como `{}` vacío. `findChangedFields` compara cada campo de `correctedData` contra `undefined` y los marca todos como "cambiados". El upsert guarda `corrected_fields = correctedData` completo, cuando el campo debería representar solo las correcciones humanas (diferencia real entre OCR raw y lo que editó el agente).

**Solución:**

Cuando no hay ejemplo previo, no hay "original" contra el que comparar → no hay correcciones conocidas → `corrected_fields` debe ser `null`. Solo tiene sentido guardar `corrected_fields` cuando `existing` existe y tiene `extracted_fields`.

**Cambio concreto:**

```ts
// ANTES (línea 63-79):
const companyName = normalizeCompanyName(...);
if (companyName) {
    await admin.from('ocr_training_examples').upsert({
        ...
        corrected_fields: Object.keys(changedFields).length > 0 ? correctedFields : null,
        ...
    });
}

// DESPUÉS:
// changedFields se calcula sobre {} vacío → no fiable → siempre null aquí
const companyName = normalizeCompanyName(...);
if (companyName) {
    await admin.from('ocr_training_examples').upsert({
        ...
        corrected_fields: null,   // sin original real, no podemos calcular diff
        is_validated: true,
        ...
    });
}
```

**Criterio de aceptación:**
- Cuando se confirma un job sin ejemplo previo, `corrected_fields` en DB es `null`
- Cuando se confirma un job con ejemplo previo y sin cambios, `corrected_fields` es `null`
- Cuando se confirma un job con ejemplo previo y con cambios, `corrected_fields` contiene solo los campos modificados

---

### Tarea 1.2 — Corregir `normalizeCompanyName` para nombres prefijados

**Archivo:** `src/app/actions/ocr-confirm.ts`

**Problema exacto:**

Las líneas de normalización usan `^` (inicio de string):

```ts
.replace(/^NATURGY.*/, 'NATURGY')
.replace(/^IBERDROLA.*/, 'IBERDROLA')
// etc.
```

Tras los pasos previos (quitar S.A., ENERGIA, non-alpha), un nombre como `"GRUPO IBERDROLA DISTRIBUCION"` se convierte en `"GRUPO IBERDROLA DISTRIBUCION"`. El anchor `^IBERDROLA` no lo captura porque empieza por `GRUPO`.

Casos reales que fallan:
- `"GRUPO NATURGY S.A."` → `"GRUPO NATURGY"` → no normaliza
- `"DISTRIBUIDORA ENDESA S.L."` → `"DISTRIBUIDORA ENDESA"` → no normaliza
- `"RED IBERDROLA DISTRIBUCION"` → `"RED IBERDROLA DISTRIBUCION"` → no normaliza

**Solución:**

Cambiar el approach: en lugar de `^NOMBRE.*` (solo al inicio), buscar si la string **contiene** el nombre canónico y devolver el canónico:

```ts
function normalizeCompanyName(raw: string): string {
    const cleaned = raw
        .toUpperCase()
        .replace(/\bS\.?A\.?\b|\bS\.?L\.?\b|\bS\.?A\.?U\.?\b/g, '')
        .replace(/ENERGIA|ENERGÍA|ENERGY/g, '')
        .replace(/[^A-ZÁÉÍÓÚÑ0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Normalización por presencia (no solo al inicio)
    const CANONICAL: [RegExp, string][] = [
        [/NATURGY/, 'NATURGY'],
        [/ENDESA/, 'ENDESA'],
        [/IBERDROLA/, 'IBERDROLA'],
        [/REPSOL/, 'REPSOL'],
        [/\bEDP\b/, 'EDP'],
        [/HOLALUZ/, 'HOLALUZ'],
        [/OCTOPUS/, 'OCTOPUS'],
        [/PODO/, 'PODO'],
    ];

    for (const [pattern, canonical] of CANONICAL) {
        if (pattern.test(cleaned)) return canonical;
    }

    return cleaned;
}
```

**Criterio de aceptación:**
- `"GRUPO NATURGY S.A."` → `"NATURGY"`
- `"IBERDROLA DISTRIBUCION S.L."` → `"IBERDROLA"`
- `"RED ELECTRICA ENDESA"` → `"ENDESA"`
- `"EDP RENOVABLES"` → `"EDP"`
- `"EMPRESA DESCONOCIDA"` → `"EMPRESA DESCONOCIDA"` (sin match, devuelve cleaned)

---

## Checkpoint 1

Antes de continuar: verificar manualmente que `ocr-confirm.ts` compila sin errores TypeScript.

```bash
npx tsc --noEmit
```

---

## Fase 2 — Hook: `useSimulator.ts`

### Tarea 2.1 — Separar el side effect `step: 2` del reducer `SET_INVOICE_DATA`

**Archivo:** `src/features/simulator/hooks/useSimulator.ts`

**Problema exacto:**

El reducer `SET_INVOICE_DATA` siempre fuerza `step: 2`:

```ts
case 'SET_INVOICE_DATA':
    return {
        ...state,
        invoiceData: action.payload,
        step: 2,              // ← SIEMPRE, sin condición
        isAnalyzing: false,
    };
```

Este reducer lo usan DOS flujos distintos:
1. **Al llegar resultado OCR** → correcto forzar step 2 (transición de carga a formulario)
2. **`setInvoiceData` (edición de campos)** → incorrecto forzar step 2 (el usuario puede estar en step 3 editando datos para recalcular)

Si en el futuro se añade edición desde resultados (step 3), se rompe silenciosamente.

**Solución:**

Añadir un nuevo action type `UPDATE_INVOICE_FIELDS` para edición de campos, que NO cambia el step:

```ts
// Nuevo action type:
| { type: 'UPDATE_INVOICE_FIELDS'; payload: InvoiceData }

// Nuevo case en el reducer:
case 'UPDATE_INVOICE_FIELDS':
    return {
        ...state,
        invoiceData: action.payload,
        // No toca step, no toca isAnalyzing
        // Resetea ocrDataConfirmed porque los datos cambiaron
        ocrDataConfirmed: false,
    };

// SET_INVOICE_DATA queda solo para llegada de OCR:
case 'SET_INVOICE_DATA':
    return {
        ...state,
        invoiceData: action.payload,
        originalInvoiceData: state.originalInvoiceData ?? action.payload,
        ocrDataConfirmed: false,
        step: 2,
        isAnalyzing: false,
    };
```

Y `setInvoiceData` (el callable público) usa el nuevo action:

```ts
const setInvoiceData = useCallback((data: InvoiceData) => {
    dispatch({ type: 'UPDATE_INVOICE_FIELDS', payload: data });
}, []);
```

**Nota importante:** `originalInvoiceData` ya NO se actualiza en `UPDATE_INVOICE_FIELDS`. Esto es correcto: el snapshot original debe mantenerse inmutable (lo que extrajo el OCR) para calcular el diff real de correcciones.

**Criterio de aceptación:**
- Editar un campo en step 2 no fuerza step: 2 en el estado (ya estamos en 2, no importa ahora, pero el código es correcto)
- Si en el futuro se llama `setInvoiceData` desde step 3, el step no cambia
- `originalInvoiceData` no muta al editar campos

---

### Tarea 2.2 — Añadir observabilidad al error de `confirmOcrData`

**Archivo:** `src/features/simulator/hooks/useSimulator.ts`

**Problema exacto:**

```ts
} catch {
    // No bloquear el flujo si falla la confirmación
    dispatch({ type: 'SET_OCR_DATA_CONFIRMED' });
    return { correctedFieldsCount: 0 };
}
```

El error se traga completamente. En producción, si el server action falla sistemáticamente (DB caído, RLS mal configurado, bug en ocr-confirm.ts), nunca lo sabremos hasta que alguien note que no hay training data.

**Solución:**

Añadir `console.warn` con contexto suficiente para diagnosticar sin bloquear el flujo:

```ts
} catch (error) {
    // No bloquear el flujo del usuario — la confirmación es best-effort
    console.warn('[OCR Confirm] Failed to save confirmation to training examples:', error);
    dispatch({ type: 'SET_OCR_DATA_CONFIRMED' });
    return { correctedFieldsCount: 0 };
}
```

**Criterio de aceptación:**
- Si el server action lanza, el error aparece en consola con mensaje identificable
- El flujo del usuario no se interrumpe (toast de éxito sigue mostrándose)
- No se añaden dependencias nuevas

---

## Checkpoint 2

Verificar TypeScript y que los nuevos action types están bien tipados:

```bash
npx tsc --noEmit
```

---

## Fase 3 — Componente UI: `SimulatorForm.tsx`

### Tarea 3.1 — Sincronizar `localConfirmed` con cambios en `invoiceData`

**Archivo:** `src/features/simulator/components/SimulatorForm.tsx`

**Problema exacto:**

```tsx
const [localConfirmed, setLocalConfirmed] = useState(false);

// En el render (línea 135):
{(ocrDataConfirmed || localConfirmed) ? (
    <div>Datos confirmados</div>   // ← persiste aunque el usuario haya editado
) : (
    <button>Confirmar datos</button>
)}
```

Flujo del bug:
1. OCR llega → `ocrDataConfirmed = false`, `localConfirmed = false` → botón "Confirmar"
2. Usuario confirma → `localConfirmed = true` → badge "Datos confirmados"
3. Usuario edita un campo → `SET_INVOICE_DATA` → `ocrDataConfirmed = false` en contexto
4. Pero `localConfirmed` sigue siendo `true` (es estado local, no se sincroniza)
5. **Bug**: badge "Datos confirmados" sigue mostrándose aunque los datos cambiaron

**Solución:**

Usar `useEffect` para resetear `localConfirmed` cuando `ocrDataConfirmed` pasa a `false`:

```tsx
// Cuando el contexto detecta que los datos cambiaron (SET_INVOICE_DATA resetea
// ocrDataConfirmed a false), sincronizar el estado local del componente.
useEffect(() => {
    if (!ocrDataConfirmed) {
        setLocalConfirmed(false);
    }
}, [ocrDataConfirmed]);
```

**Por qué este approach y no otros:**

- Opción A (usar solo `ocrDataConfirmed`): requeriría que el dispatch `SET_OCR_DATA_CONFIRMED` sea síncrono con el server action, pero el diseño actual es fire-and-forget con feedback inmediato → `localConfirmed` es necesario para el feedback visual instantáneo.
- Opción B (elevar `localConfirmed` al contexto): over-engineering para un estado que es 100% UI.
- **Opción C (useEffect, elegida)**: mantiene la arquitectura actual, respeta el fire-and-forget, y sincroniza cuando el contexto "sabe" que los datos cambiaron.

**Criterio de aceptación:**
- Usuario confirma → badge "Datos confirmados" aparece inmediatamente
- Usuario edita cualquier campo → badge desaparece, vuelve el botón "Confirmar datos"
- Usuario confirma de nuevo → badge reaparece
- Si `ocrJobId` es null (mock mode), el flujo funciona igual

---

## Checkpoint 3 — Verificación end-to-end

Flujo manual a verificar:

1. Subir factura PDF real
2. Esperar OCR → llegar a step 2
3. **Verificar:** botón "Confirmar datos" visible
4. Hacer click en "Confirmar datos"
5. **Verificar:** badge "Datos confirmados" aparece en ≤600ms
6. Editar cualquier campo (ej: cliente)
7. **Verificar:** badge desaparece, vuelve botón "Confirmar datos"
8. Confirmar de nuevo
9. **Verificar:** badge reaparece
10. En Supabase: comprobar `ocr_training_examples` tiene `is_validated=true` y `corrected_fields` correcto

---

## Fase 4 (INFO) — Prop `_originalData` en `SimulatorForm`

**Estado:** No implementar ahora. Es Phase 2 en progreso.

La prop está recibida y prefijada con `_` correctamente. Cuando se implemente la comparación visual (highlight de campos cambiados vs OCR original), se retirará el prefijo y se usará. No requiere ningún cambio en este plan.

---

## Orden de implementación recomendado

```
Fase 1.1 → Fase 1.2 → Checkpoint 1 (tsc)
    → Fase 2.1 → Fase 2.2 → Checkpoint 2 (tsc)
        → Fase 3.1 → Checkpoint 3 (manual e2e)
```

Las fases van de más profundo (server action, sin deps de UI) a más superficial (componente UI), lo que minimiza el riesgo de introducir bugs al refactorizar.

---

## Archivos a modificar

| Archivo | Tareas |
|---------|--------|
| `src/app/actions/ocr-confirm.ts` | 1.1, 1.2 |
| `src/features/simulator/hooks/useSimulator.ts` | 2.1, 2.2 |
| `src/features/simulator/components/SimulatorForm.tsx` | 3.1 |

**Archivos que NO se tocan:**
- `SimulatorView.tsx` — el plumbing ya está correcto
- `SimulatorContext.tsx` — thin wrapper, sin lógica
- Ningún archivo de DB/migrations necesario

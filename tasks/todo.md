# TODO — Correcciones Auditoría OCR Simulator

## Fase 1 — ocr-confirm.ts

- [ ] **1.1** Corregir `corrected_fields=null` cuando no existe ejemplo previo (línea ~69)
- [ ] **1.2** Reescribir `normalizeCompanyName` con array de patrones en lugar de anchors `^`
- [ ] **CP1** `npx tsc --noEmit` — sin errores

## Fase 2 — useSimulator.ts

- [ ] **2.1** Añadir action type `UPDATE_INVOICE_FIELDS` que no toca `step` ni `originalInvoiceData`
- [ ] **2.1** Cambiar `setInvoiceData` para usar `UPDATE_INVOICE_FIELDS` en lugar de `SET_INVOICE_DATA`
- [ ] **2.2** Añadir `console.warn` en el catch de `confirmOcrData`
- [ ] **CP2** `npx tsc --noEmit` — sin errores

## Fase 3 — SimulatorForm.tsx

- [ ] **3.1** Añadir `useEffect` que resetea `localConfirmed` cuando `ocrDataConfirmed` pasa a `false`
- [ ] **CP3** Verificación manual end-to-end (subir factura → confirmar → editar → re-confirmar)

## Post-implementación

- [ ] Commit con mensaje `fix(simulator): sync confirm state and OCR training data correctness`

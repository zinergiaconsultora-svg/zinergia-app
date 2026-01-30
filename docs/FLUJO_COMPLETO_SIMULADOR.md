# Flujo Completo del Simulador de Facturas

## Arquitectura del Flujo

### 1. **SIMULADOR** (`/dashboard/simulator`)
- **Hook**: `useSimulator`
- **Vista**: `SimulatorView`
- **Pasos**: 3 pasos (subir, revisar, resultados)

### 2. **COMPARADOR** (`/dashboard/comparator`)
- **Hook**: `useComparator`
- **Vista**: `ComparatorView`
- **Pasos**: 4 pasos (subir, verificar, calcular, propuestas)

---

## Webhooks Utilizados

### Webhook 1: OCR - Extracción de Datos
```
URL: https://sswebhook.iawarrior.com/webhook/cee8e0d1-b537-4939-b54e-6255fa9776cc
Método: POST
Content-Type: multipart/form-data
Input: File (PDF)
Output: [{ output: { cliente_nombre, potencia_p1, energia_p1, ... } }]
```

**Campos mapeados** (español → inglés):
- `cliente_nombre` → `client_name`
- `nif_cif` → `dni_cif`
- `compania` → `company_name`
- `potencia_p1`...`potencia_p6` → `power_p1`...`power_p6`
- `energia_p1`...`energia_p6` → `energy_p1`...`energy_p6`
- `precio_potencia_p1`...`precio_potencia_p6` → `current_power_price_p1`...`current_power_price_p6`
- `precio_energia_p1`...`precio_energia_p6` → `current_energy_price_p1`...`current_energy_price_p6`
- `subtotal`, `iva`, `importe_total` → `subtotal`, `vat`, `total_amount`

### Webhook 2: Comparación de Tarifas
```
URL: https://sswebhook.iawarrior.com/webhook/effcc85b-5122-4896-9f0c-810e724e12c3
Método: POST
Content-Type: application/json
Input: InvoiceData (completo)
Output: [{ output: { current_annual_cost, offers: [...] } }]
```

---

## Flujo Detallado del Simulador

### PASO 1: Subir Factura
```
Usuario → SimulatorView (step 1)
  ↓ Sube PDF
useSimulator.handleFileUpload / handleDrop
  ↓ processInvoice()
crmService.analyzeDocument(file)
  ↓ POST a Webhook OCR
Webhook OCR devuelve datos
  ↓ Mapeo español → inglés
setInvoiceData(data)
  ↓ setStep(2)
SimulatorView (step 2)
```

**Estado**:
- `isAnalyzing = true` durante carga
- `invoiceData` se actualiza con datos extraídos
- `uploadError` si falla

### PASO 2: Revisión de Datos
```
Usuario → SimulatorView (step 2)
  ↓ Verifica/Edita campos
updateInvoiceField(key, value)
  ↓
Usuario → Click "Comparativa de Tarifas"
useSimulator.runComparison()
  ↓ setIsAnalyzing(true)
  ↓ Loading messages (cada 800ms)
crmService.calculateSavings(invoiceData)
  ↓ POST a Webhook Comparación
Webhook Comparación devuelve ofertas
  ↓ Mapeo de ofertas
setResults(topResults)
  ↓ Guarda en localStorage/sessionStorage
setStep(3)
SimulatorView (step 3)
```

**Datos guardados**:
- `antigravity_simulator_result` - Mejor oferta
- `antigravity_simulator_invoice` - Datos factura
- `simulator_result` - Copia en sessionStorage
- `simulator_invoice` - Copia en sessionStorage

### PASO 3: Resultados
```
SimulatorView (step 3)
  ↓ Muestra top 3 ofertas
DigitalProposalCard × 3
  ↓ Usuario puede:
  - Ver propuesta detallada
  - Enviar por email
  - Nueva simulación → reset()
```

---

## Flujo Detallado del Comparador

### PASO 1: Subir Factura
```
Usuario → ComparatorView (step 1)
  ↓ Sube PDF o click "manual"
useComparator.handleFileUpload
  ↓ processInvoice()
crmService.analyzeDocument(file)
  ↓ Webhook OCR
setInvoiceData(data)
setClientName(data.client_name)
setStep(2)
ComparatorView (step 2)
```

### PASO 2: Verificación
```
ComparatorView (step 2)
  ↓ Verifica datos administrativos
  ↓ Verifica totales financieros
  ↓ Verifica potencias y energía
  ↓ Verifica precios
Usuario → Click "Calcular Ahorro"
useComparator.runAnalysis()
  ↓ crmService.calculateSavings(invoiceData)
  ↓ Webhook Comparación
setResults(topResults)
  ↓ Guarda en localStorage/sessionStorage
setStep(4)
ComparatorView (step 4)
```

**Datos guardados**:
- `antigravity_comparator_result`
- `antigravity_comparator_invoice`
- `comparator_result`
- `comparator_invoice`

### PASO 3: No existe
El comparador salta del paso 2 al paso 4 directamente.

### PASO 4: Propuestas
```
ComparatorView (step 4)
  ↓ Muestra top 2 ofertas
DigitalProposalCard × 2
  ↓ Usuario puede:
  - Ver propuesta
  - Enviar email (EmailModal)
  - Nueva comparación → reset()
```

---

## Componentes Clave

### useSimulator
```typescript
{
  step, setStep,                    // Estado actual (1|2|3)
  isAnalyzing,                      // Loading state
  invoiceData, setInvoiceData,      // Datos factura
  uploadError,                      // Error si falla
  results,                          // SavingsResult[]
  loadingMessage,                   // Mensaje de carga
  handleFileUpload,                 // Input file change
  handleDrop,                       // Drag & drop
  handleDragOver,                   // Drag over
  runComparison,                    // Calcular ahorro
  reset: handleReset,               // Reiniciar
  goBackToStep1                     // Volver al inicio
}
```

### useComparator
```typescript
{
  step, setStep,                    // Estado actual (1|2|4)
  isAnalyzing,
  invoiceData, setInvoiceData,
  clientName, setClientName,        // Nombre del cliente
  uploadError,
  results,
  loadingMessage,
  isEmailModalOpen, setIsEmailModalOpen,  // Modal de email
  handleFileUpload,
  handleDrop,
  handleDragOver,
  runAnalysis,                      // Calcular (renombrado)
  reset: handleReset,
  goBackToPhase1,                   // Volver a paso 1
  goBackToPhase2                    // Volver a paso 2
}
```

### crmService
```typescript
// Webhook 1: OCR
analyzeDocument(file: File): Promise<InvoiceData>

// Webhook 2: Comparación
calculateSavings(invoice: InvoiceData): Promise<SavingsResult[]>
```

---

## Flujo de Datos

### 1. Usuario sube factura
```
PDF → FormData → Webhook OCR → JSON (español) → InvoiceData (inglés) → Estado
```

### 2. Usuario verifica datos
```
Estado → Inputs editables → updateInvoiceField() → Estado modificado
```

### 3. Usuario compara tarifas
```
InvoiceData → JSON → Webhook Comparación → JSON (español/inglés) → SavingsResult[] → Estado
```

### 4. Sistema guarda resultados
```
SavingsResult[0] → localStorage + sessionStorage → Proposal view puede acceder
```

---

## Logs de Depuración

### Webhook OCR
```
📤 Sending PDF to OCR webhook...
📥 Received OCR response: {...}
✅ Data extracted, moving to step 2
```

### Webhook Comparación
```
📤 Sending invoice data to comparison webhook: {...}
📥 Received response from webhook: {...}
✅ Parsed 3 offers from webhook response
💾 Data saved to localStorage and sessionStorage
```

### Errores
```
❌ Error processing invoice: ...
❌ Webhook returned error: 500 Internal Server Error
❌ Webhook unavailable, using mock data: ...
⚠️ Webhook response missing offers array
```

---

## Puntos de Integración

### SimulatorView → Proposal View
```typescript
// Paso 3 del simulador guarda:
localStorage.setItem('antigravity_simulator_result', JSON.stringify(topResults[0]));
localStorage.setItem('antigravity_simulator_invoice', JSON.stringify(invoiceData));

// Proposal view lee:
const result = JSON.parse(localStorage.getItem('antigravity_simulator_result'));
const invoice = JSON.parse(localStorage.getItem('antigravity_simulator_invoice'));
```

### ComparatorView → Proposal View
```typescript
// Paso 4 del comparador guarda:
localStorage.setItem('antigravity_comparator_result', JSON.stringify(topResults[0]));
localStorage.setItem('antigravity_comparator_invoice', JSON.stringify(invoiceData));

// Proposal view lee:
const result = JSON.parse(localStorage.getItem('antigravity_comparator_result'));
const invoice = JSON.parse(localStorage.getItem('antigravity_comparator_invoice'));
```

---

## Validaciones

### Paso 1 (Subir)
- [x] Solo acepta archivos PDF
- [x] Maneja drag & drop
- [x] Muestra loading durante análisis
- [x] Muestra error si falla webhook

### Paso 2 (Revisar/Verificar)
- [x] Todos los campos son editables
- [x] Muestra tipo de potencia (2.0/3.0/3.1)
- [x] Muestra datos administrativos
- [x] Muestra datos financieros
- [x] Muestra potencias y energía
- [x] Muestra precios de potencia y energía

### Paso 3/4 (Resultados)
- [x] Muestra top 3 (simulador) o top 2 (comparador)
- [x] Primer resultado tiene optimization_result
- [x] Cards son interactivas
- [x] Modal de email funciona
- [x] Reset reinicia todo el flujo

---

## Fallbacks

### Webhook OCR falla
- Lanza excepción con mensaje descriptivo
- Usuario ve error en UI
- Puede intentar de nuevo

### Webhook Comparación falla
- Usa datos mock automáticamente
- 2 ofertas mock (Energía Plus, Luz Directa)
- 15% y 8% de ahorro respectivamente
- No interrumpe el flujo

---

## Mejoras Implementadas

### 1. Mapeo Bilingüe
Ambos webhooks devuelven datos en español e inglés
```typescript
client_name || CLIENTE_NOMBRE || cliente_nombre
marketer_name || comercializadora || company_name
```

### 2. Logs Detallados
Todos los pasos tienen logs para depuración
```typescript
console.log('✅ Data extracted');
console.log('💾 Data saved to localStorage');
```

### 3. Manejo de Errores
Try-catch en todos los endpoints
```typescript
try { ... } catch (error) {
  console.error('Error:', error);
  setUploadError(error.message);
}
```

### 4. Estados Consistentes
localStorage y sessionStorage sincronizados
Para acceso desde Proposal view

---

## Resumen del Flujo Completo

```
USUARIO SUBE PDF
  ↓
Webhook OCR extrae datos
  ↓
Usuario verifica/edita (step 2)
  ↓
Usuario solicita comparación
  ↓
Webhook Comparación calcula ofertas
  ↓
Sistema muestra mejores propuestas (step 3/4)
  ↓
Usuario puede:
  - Ver detalles
  - Enviar email
  - Nueva simulación
```

## Checklist de Implementación

- [x] Webhook OCR: mapeo español → inglés
- [x] Webhook Comparación: mapeo bilingüe
- [x] useComparator: estados clientName, isEmailModalOpen
- [x] useComparator: renombrado runComparison → runAnalysis
- [x] useComparator: processInvoice cambia a step 2
- [x] Logs detallados en ambos webhooks
- [x] Fallback a mock si webhook falla
- [x] Almacenamiento en localStorage/sessionStorage
- [x] DigitalProposalCard muestra resultados
- [x] EmailModal integrado en ComparatorView

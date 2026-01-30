# 🔒 Análisis de Seguridad y Mejoras del Simulador

## 🚨 Problemas Críticos de Seguridad Identificados

### 1. **Webhooks Expuestos (CRITICAL)**
```typescript
// ❌ ACTUAL - URLs hardcodeadas en cliente
const response = await fetch('https://sswebhook.iawarrior.com/webhook/cee8e0d1-...');
const response = await fetch('https://sswebhook.iawarrior.com/webhook/effcc85b-...');
```
**Riesgos:**
- Cualquiera puede ver las URLs en el código cliente
- No hay autenticación ni tokens
- Vulnerable a abuso y ataques DDoS
- Sin rate limiting

### 2. **Datos Sensibles en Logs (HIGH)**
```typescript
// ❌ ACTUAL - Datos expuestos en consola
console.log('📤 Sending invoice data to comparison webhook:', JSON.stringify(invoice, null, 2));
console.log('📥 Received response from webhook:', JSON.stringify(responseData, null, 2));
```
**Riesgos:**
- PII (Personal Identifiable Information) en logs
- CUPS, DNI/CIF expuestos
- Datos de consumo visibles

### 3. **Sin Validación de Respuestas (MEDIUM)**
```typescript
// ❌ ACTUAL - Confía ciegamente en el webhook
const data = Array.isArray(responseData) ? responseData[0]?.output : responseData;
return data as InvoiceData;
```
**Riesgos:**
- Inyección de código/malware
- XSS si se renderiza sin sanitizar
- Respuestas malformadas causan errores

### 4. **Fallo Silencioso a Mock (MEDIUM)**
```typescript
// ❌ ACTUAL - Fallback sin control
catch (error) {
    console.error('❌ Webhook unavailable, using mock data:', error);
    return [/* mock data */]; // Usuario nunca sabe que es falso
}
```
**Riesgos:**
- Usuario cree que son datos reales
- Decisiones basadas en datos falsos
- Sin indicador visual de "modo demo"

### 5. **Sin Validación de Archivos (LOW-MEDIUM)**
```typescript
// ❌ ACTUAL - Sin validación
if (file && file.type === 'application/pdf') {
    await processInvoice(file);
}
```
**Riesgos:**
- Archivos maliciosos
- PDFs corruptos
- Sin límite de tamaño
- Sin escaneo de virus

---

## 💡 Problemas de Funcionalidad

### 1. **Manejo de Errores Básico**
- Sin reintentos automáticos
- Sin backoff exponencial
- Timeout no configurado
- Errores genéricos

### 2. **Performance**
- Sin caché de resultados
- Sin debouncing
- Cargas múltiples innecesarias
- Sin preload de recursos

### 3. **Experiencia de Usuario**
- Sin historial de simulaciones
- Sin comparación entre facturas
- Sin exportación de resultados
- Sin compartir resultados
- Sin guardar como borrador

### 4. **Validación de Datos**
- Sin validación de rangos (potencias negativas)
- Sin detección de anomalías
- Sin warnings de consumo inusual
- Sin comparación con mercado

---

## ✨ Plan de Mejoras Propuesto

### FASE 1: Seguridad Crítica (Inmediato)

#### 1.1 Proxy API para Webhooks
```typescript
// ✅ MEJORA - Webhooks a través de API Route segura
// /api/webhooks/ocr
// /api/webhooks/compare

// BENEFICIOS:
// - URLs ocultas en servidor
// - Autenticación con API keys
// - Rate limiting por IP
// - Logs controlados en servidor
// - Validación de respuestas
```

#### 1.2 Eliminar Logs Sensibles
```typescript
// ✅ MEJORA - Logs seguros
logger.info('Document analysis started', { 
    fileSize: file.size,
    fileType: file.type 
    // NO datos del documento
});
```

#### 1.3 Validación Estricta de Respuestas
```typescript
// ✅ MEJORA - Schema validation con Zod
const InvoiceDataSchema = z.object({
    client_name: z.string().max(200),
    cups: z.string().regex(/^ES\d{20}$/),
    power_p1: z.number().min(0).max(100),
    // ... más validaciones
});

const validated = InvoiceDataSchema.parse(data);
```

#### 1.4 Indicador Visual de Modo Demo
```typescript
// ✅ MEJORA - Usuario sabe cuando son datos mock
{isMockMode && (
    <Alert variant="warning">
        Modo demostración - Los datos no son reales
    </Alert>
)}
```

### FASE 2: Funcionalidades Mejoradas

#### 2.1 Sistema de Reintentos
```typescript
// ✅ MEJORA - Reintentos con backoff
const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fetch(url, options);
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        }
    }
};
```

#### 2.2 Cache Inteligente
```typescript
// ✅ MEJORA - Caché con SWR
const { data, error } = useSWR(
    file ? `invoice-${file.size}-${file.lastModified}` : null,
    () => analyzeDocument(file),
    {
        revalidateOnFocus: false,
        dedupingInterval: 60000 // 1 minuto
    }
);
```

#### 2.3 Validación de Archivos
```typescript
// ✅ MEJORA - Validación completa
const validateFile = (file: File) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (file.size > MAX_SIZE) {
        throw new Error('El archivo excede 10MB');
    }
    
    if (file.type !== 'application/pdf') {
        throw new Error('Solo se permiten archivos PDF');
    }
    
    // Validación de magic numbers
    const arrayBuffer = file.slice(0, 4);
    const view = new DataView(arrayBuffer);
    if (view.getUint32(0) !== 0x25504446) { // %PDF
        throw new Error('Archivo PDF inválido');
    }
};
```

#### 2.4 Historial de Simulaciones
```typescript
// ✅ MEJORA - Guardar en Supabase
interface SimulationHistory {
    id: string;
    user_id: string;
    invoice_data: InvoiceData;
    results: SavingsResult[];
    created_at: string;
    is_mock: boolean;
}

// Guardar automáticamente cada simulación
await supabase.from('simulation_history').insert({
    user_id: user.id,
    invoice_data: invoiceData,
    results: results,
    is_mock: isMockMode
});
```

#### 2.5 Exportación de Resultados
```typescript
// ✅ MEJORA - Exportar a PDF/Excel
const exportResults = async (results: SavingsResult[]) => {
    // Generar PDF con jsPDF
    const doc = new jsPDF();
    doc.text('Reporte de Comparación', 20, 20);
    // ... más contenido
    
    // O exportar a Excel
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Comparación');
    XLSX.writeFile(wb, 'comparacion.tarifas.xlsx');
};
```

### FASE 3: UX Premium

#### 3.1 Comparador Múltiple
```typescript
// ✅ MEJORA - Comparar hasta 3 facturas
const [invoices, setInvoices] = useState<InvoiceData[]>([]);
const [results, setResults] = useState<SimulationResult[][]>();

// Mostrar tabla comparativa
<ComparisonTable results={results} />
```

#### 3.2 Gráficos Interactivos
```typescript
// ✅ MEJORA - Visualización con Recharts
<BarChart data={results}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="offer.marketer_name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="annual_savings" fill="#10b981" />
</BarChart>
```

#### 3.3 Compartir Resultados
```typescript
// ✅ MEJORA - Link único compartible
const shareResults = async (simulationId: string) => {
    const { data } = await supabase.functions.invoke('create-share-link', {
        body: { simulationId }
    });
    
    // Generar URL única
    // https://zinergia.app/share/abc123
    return `https://zinergia.app/share/${data.slug}`;
};
```

---

## 📊 Comparativa Antes vs Después

| Aspecto | Actual | Propuesto |
|---------|--------|-----------|
| **Seguridad** | Webhooks expuestos | Proxy con autenticación |
| **Logs** | Datos sensibles | Logs anonimizados |
| **Validación** | Sin validación | Schema + validaciones estrictas |
| **Errores** | Genéricos | Específicos con reintentos |
| **Caché** | Sin caché | SWR con invalidación |
| **Historial** | No | Guardado en Supabase |
| **Exportación** | No | PDF + Excel |
| **Comparación** | 1 factura | Hasta 3 facturas |
| **Gráficos** | No | Recharts interactivo |
| **Compartir** | No | Links únicos |

---

## 🚀 Roadmap de Implementación

### Semana 1: Seguridad Crítica
- [ ] Crear API Routes para webhooks (`/api/webhooks/*`)
- [ ] Implementar autenticación con API keys
- [ ] Agregar rate limiting
- [ ] Remover logs sensibles
- [ ] Implementar schema validation con Zod
- [ ] Agregar indicador de modo demo

### Semana 2: Funcionalidades Core
- [ ] Implementar reintentos con backoff
- [ ] Agregar caché con SWR
- [ ] Validación estricta de archivos
- [ ] Historial de simulaciones en Supabase
- [ ] Exportación a PDF

### Semana 3: UX Premium
- [ ] Comparador múltiple de facturas
- [ ] Gráficos interactivos con Recharts
- [ ] Sistema de compartir resultados
- [ ] Análisis de tendencias
- [ ] Alertas de anomalías

---

## 🎯 Próximos Pasos

¿Por dónde quieres empezar?

1. **Implementar seguridad crítica primero** (Recomendado)
2. **Mejorar funcionalidades existentes**
3. **Agregar nuevas features premium**

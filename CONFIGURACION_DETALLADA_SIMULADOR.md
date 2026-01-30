# 📘 Guía de Configuración Completa - Simulador Mejorado

## 📋 Índice
1. Configuración de Supabase
2. Variables de Entorno
3. Configuración de Vercel
4. Testing Completo
5. Solución de Problemas

---

## 1️⃣ CONFIGURACIÓN DE SUPABASE

### Paso 1.1: Acceder a Supabase

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a: SQL Editor (en el menú lateral)

### Paso 1.2: Crear Tablas

Copia y pega el siguiente código en el SQL Editor:

```sql
-- ========================================
-- TABLA: Historial de Simulaciones
-- ========================================

-- Crear tabla de historial
CREATE TABLE IF NOT EXISTS simulation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invoice_data JSONB NOT NULL,
    results JSONB NOT NULL,
    is_mock BOOLEAN DEFAULT false,
    total_savings DECIMAL(10, 2) NOT NULL,
    best_offer_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Crear índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_simulation_history_user_created 
ON simulation_history(user_id, created_at DESC);

-- Habilitar Row Level Security
ALTER TABLE simulation_history ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios pueden ver sus propias simulaciones
CREATE POLICY "Users can view their own simulations"
    ON simulation_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own simulations"
    ON simulation_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own simulations"
    ON simulation_history FOR DELETE
    USING (auth.uid() = user_id);

-- ========================================
-- TABLA: Simulaciones Compartidas
-- ========================================

CREATE TABLE IF NOT EXISTS shared_simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_id UUID REFERENCES simulation_history(id) ON DELETE CASCADE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Crear índice para búsqueda por slug
CREATE INDEX IF NOT EXISTS idx_shared_simulations_slug 
ON shared_simulations(slug);

-- Habilitar RLS
ALTER TABLE shared_simulations ENABLE ROW LEVEL SECURITY;

-- Política: Cualquiera puede ver simulaciones compartidas
CREATE POLICY "Anyone can view shared simulations"
    ON shared_simulations FOR SELECT
    USING (true);

-- ========================================
-- FUNCIÓN: Limpiar shares expirados
-- ========================================

CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS void AS $$
BEGIN
    DELETE FROM shared_simulations
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

### Paso 1.3: Verificar Creación

Click en "Run" o presiona `Ctrl+Enter`

**Deberías ver:**
- ✅ Tabla `simulation_history` creada
- ✅ Tabla `shared_simulations` creada
- ✅ Índices creados
- ✅ Políticas RLS aplicadas

---

## 2️⃣ VARIABLES DE ENTORNO

### Paso 2.1: Generar API Key Segura

**Opción A: Con OpenSSL (Recomendado)**
```bash
# En Git Bash o PowerShell:
openssl rand -hex 32
# Resultado: 64 caracteres hexadecimales
```

**Opción B: Generador Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Opción C: Generador Online**
- Ve a: https://randomkeygen.com/
- Longitud: 64 caracteres
- Tipo: Hexadecimal
- Click: "Generate"

### Paso 2.2: Crear Archivo `.env.local`

Crea el archivo en la raíz del proyecto:

```bash
# En la raíz del proyecto
touch .env.local
```

### Paso 2.3: Agregar Variables

Copia y pega en `.env.local`:

```env
# ========================================
# WEBHOOK CONFIGURACIÓN
# ========================================
# Genera tu API key con: openssl rand -hex 32
WEBHOOK_API_KEY=tu-api-key-de-64-caracteres-aqui

# URLs de webhooks (ocultas en servidor, expuestas solo aquí)
OCR_WEBHOOK_URL=https://sswebhook.iawarrior.com/webhook/cee8e0d1-b537-4939-b54e-6255fa9776cc
COMPARISON_WEBHOOK_URL=https://sswebhook.iawarrior.com/webhook/effcc85b-5122-4896-9f0c-810e724e12c3

# ========================================
# VARIABLES EXISTENTES (no modificar)
# ========================================
NEXT_PUBLIC_SUPABASE_URL=https://jycwgzdrysesfcxgrxwg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5Y3dnemRyeXNlc2ZjeC4Ry08wMTc3NjYxNjYsImV4cCI6MjA4MTMwMjE2Nn0.sdkdlURchIjjGHsTjlnfTjypbqGl9lKyEl-ukJbeEic
RESEND_API_KEY=re_AujCRBQN_FHiazFSr5oTfzLnFX5szgCGe

# NEXT_PUBLIC_WEBHOOK_API_KEY es opcional, para desarrollo
# NEXT_PUBLIC_WEBHOOK_API_KEY=dev-key
```

### Paso 2.4: Verificar Archivo

```bash
cat .env.local
```

**Deberías ver todas las variables anteriores.**

---

## 3️⃣ CONFIGURACIÓN DE VERCEL

### Paso 3.1: Abrir Dashboard de Vercel

1. Ve a: https://vercel.com/dashboard
2. Selecciona: `zinergia` (o tu proyecto)
3. Ve a: Settings → Environment Variables

### Paso 3.2: Agregar Variables de Entorno

Para cada variable, haz clic en "Add New":

| Variable | Value | Environment |
|---------|-------|------------|
| `WEBHOOK_API_KEY` | Tu API key de 64 caracteres | Production, Preview, Development |
| `OCR_WEBHOOK_URL` | `https://sswebhook.iawarrior.com/webhook/cee8e0d1-...` | Production, Preview, Development |
| `COMPARISON_WEBHOOK_URL` | `https://sswebhook.iawerrar.com/webhook/effcc85b-...` | Production, Preview, Development |

**IMPORTANTE:**
- ✅ Agrega las 3 variables a TODOS los entornos
- ✅ Copia exactamente las URLs (sin espacios extra)
- ✅ No agregues comillas al final
- ✅ Click en "Save" después de cada una

### Paso 3.3: Verificar Configuración

Deberías ver:
```
✅ WEBHOOK_API_KEY
✅ OCR_WEBHOOK_URL
✅ COMPARISON_WEBHOOK_URL
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## 4️⃣ TESTING COMPLETO

### Paso 4.1: Testing Local

```bash
npm run dev
```

Abre: http://localhost:3000/dashboard/simulator

#### Test 1: Subida de Factura
1. Sube un PDF de factura
2. ✅ Debería analizar en segundos
3. ✅ Mostrar datos extraídos
4. ✅ Validar que sea el modo correcto de tarifa (2.0, 3.0, 3.1)

#### Test 2: Comparación de Tarifas
1. Click en "Comparativa de Tarifas"
2. ✅ Verificar animación de carga
3. ✅ Verificar 3 propuestas aparezcan
4. ✅ Verificar cálculo de ahorro

#### Test 3: Exportar a PDF
1. Click en botón exportar PDF
2. ✅ Debería descargar archivo PDF
3. ✅ Abrir PDF y verificar contenido
4. ✅ Verificar formato profesional

#### Test 4: Exportar a Excel
1. Click en botón exportar Excel
2. ✅ Debería descargar archivo .xlsx
3. ✅ Abrir Excel y verificar hojas:
   - Resumen
   - Ofertas
   - Precios Detallados

#### Test 5: Modo Demo (si fallan webhooks)
1. Si los webhooks fallan
2. ✅ Debería aparecer alerta amarilla
3. ✅ Usuario sabe que son datos de prueba

### Paso 4.2: Testing Comparador Múltiple

Crea nueva página: `/dashboard/comparar-multiple`

```typescript
// src/app/dashboard/comparar-multiple/page.tsx
'use client';

import { MultipleComparisonView } from '@/features/simulator/components/MultipleComparisonView';

export default function Page() {
    return <MultipleComparisonView />;
}
```

Test:
1. Sube hasta 3 facturas diferentes
2. ✅ Cada una se procesa independientemente
3. ✅ Comparación automática al tener todas analizadas
4. ✅ Verificar comparación lado a lado

### Paso 4.3: Testing Gráficos

En vista de resultados, verifica:
1. ✅ Gráfico de barras: Costo vs Ahorro
2. ✅ Gráfico circular: Desglose de costos
3. ✅ Tooltips funcionan al hacer hover
4. ✅ Colores semánticos correctos

### Paso 4.4: Testing Compartir

1. Click en botón "Compartir"
2. ✅ Modal se abre
3. ✅ Selecciona expiración (7 días)
4. ✅ Click en "Generar Link"
5. ✅ Link generado se copia al portapapeles
6. ✅ QR code se muestra (futuro: implementar librería QR real)

### Paso 4.5: Testing Historial

1. Abre el simulador
2. Completa una simulación
3. Debería guardar automáticamente en historial
4. Abre vista de historial
5. ✅ Ver simulación guardada aparece
6. ✅ Click en "Ver" recarga la simulación

### Paso 4.6: Testing Alertas de Anomalías

Sube una factura con:
- ✅ Consumo > 100 kWh/día → Alerta warning
- ✅ Consumo < 5 kWh/día → Alerta error
- ✅ Potencia > €50/mes → Alerta warning
- ✅ Tarifa con discriminación → Alerta info

---

## 5️⃣ SOLUCIÓN DE PROBLEMAS

### Problema 1: Error "Webhook failed"

**Síntoma:**
```
❌ Webhook unavailable, using mock data
```

**Causa:** Webhook no responde o API key incorrecta

**Solución:**
1. Verifica `.env.local` tiene las URLs correctas
2. Genera nueva API key con: `openssl rand -hex 32`
3. Verifica conexión a internet
4. Contacta al administrador si el webhook está caído

### Problema 2: Error "Invalid API key"

**Síntoma:**
```
❌ Unauthorized - Invalid API key
```

**Causa:** API key no coincide

**Solución:**
1. Verifica que WEBHOOK_API_KEY es correcto
2. Asegúrate que no haya espacios extras al final
3. Recuerda: Debe tener 64 caracteres hexadecimales

**Ejemplo INCORRECTO:**
```env
WEBHOOK_API_KEY=mi-clave-123  # ❌ Espacios, corta
```

**Ejemplo CORRECTO:**
```env
WEBHOOK_API_KEY=a1b2c3d4e5f6...64chars # ✅ 64 hex characters
```

### Problema 3: Error "Table simulation_history does not exist"

**Síntoma:**
```
❌ relation "simulation_history" does not exist
```

**Causa:** Tablas no creadas en Supabase

**Solución:**
1. Ve a Supabase → SQL Editor
2. Copia y pega el SQL de `supabase_migrations_simulator.sql`
3. Click "Run" o `Ctrl+Enter`
4. Verifica que las tablas se crearon exitosamente

### Problema 4: Exportación PDF no funciona

**Síntoma:**
```
❌ Error al exportar a PDF
```

**Causa:** Falta dependencia jsPDF o error en implementación

**Solución:**
```bash
# Instalar dependencias
npm install jspdf
npm install --save-dev @types/jspdf
```

### Problema 5: Exportación Excel no funciona

**Síntoma:**
```
❌ Error al exportar a Excel
```

**Causa:** Falta dependencia xlsx

**Solución:**
```bash
npm install xlsx
npm install --save-dev @types/xlsx
```

### Problema 6: Gráficos no renderizan

**Síntoma:** Gráficos en blanco o vacíos

**Causa:** Datos incorrectos o error en formato

**Solución:**
1. Verifica que results array tiene datos correctos
2. Abre consola (F12) para ver errores
3. Verifica que invoiceData tenga datos de consumo
4. Recharts requiere datos numéricos válidos

**Debug en consola:**
```javascript
console.log('Results:', results);
console.log('Invoice Data:', invoiceData);
```

### Problema 7: Historial no guarda

**Síntoma:** Las simulaciones no se guardan

**Causa:** Error en Supabase o permisos

**Solución:**
1. Verifica RLS policies en Supabase
2. Verifica que estás autenticado
3. Verifica que user_id existe en profiles table
4. Revisa logs de Supabase

**Test de conexión:**
```typescript
const supabase = createClient();
const { data } = await supabase.from('simulation_history').select('*');
console.log('History test:', data);
```

### Problema 8: Rate limit exceeded

**Síntoma:**
```
❌ Rate limit exceeded
```

**Causa:** Demasiadas requests en poco tiempo

**Solución:**
- Espera 1 minuto
- Reduce frecuencia de llamadas
- Aumenta límites en código si necesario

### Problema 9: Modo demo siempre visible

**Síntoma:** Alerta amarilla siempre aparece

**Causa:** No hay modo production configurado

**Solución:**
1. Verifica que `process.env.NODE_ENV === 'development'` en código
2. En production, mock mode debería desactivarse
3. Revisa `webhookService.ts` línea 111

---

## 6️⃣ CHECKLIST PRE-DEPLOY

### Supabase ✅
- [ ] Tablas creadas en SQL Editor
- [ ] RLS policies aplicadas
- [ ] Índices creados
- [ ] Función `cleanup_expired_shares` funciona

### Variables de Entorno ✅
- [ ] `.env.local` creado
- [ ] `WEBHOOK_API_KEY` generada (64 caracteres hex)
- [ ] URLs de webhook configuradas
- [ ] API key agregada a Vercel

### Dependencias ✅
- [ ] `zod` instalado
- [ ] `xlsx` instalado
- [ ] `@types/xlsx` instalado
- [ ] `jspdf` instalado

### Testing ✅
- [ ] Subida de PDF funciona
- [ ] Comparación de tarifas funciona
- [ ] Exportación PDF funciona
- [ ] Exportación Excel funciona
- [ ] Gráficos renderizan correctamente
- [ ] Historial guarda correctamente
- [ ] Compartir genera links
- [️] Alertas de anomalías funcionan

### Deploy ✅
- [ ] Variables configuradas en Vercel
- [ ] Build local exitoso: `npm run build`
- [ ] Deploy a preview funciona
- [ ] Deploy a production funciona

---

## 7️⃣ DEPLOY A PRODUCCIÓN

### Paso 7.1: Build de Producción

```bash
npm run build
```

**Deberías ver:**
```
✅ Build completed
✅ No errors TypeScript
✅ Static pages generated
✅ API routes compiled
```

### Paso 7.2: Deploy a Vercel

```bash
vercel --prod
```

**Output esperado:**
```
✅ Preview: https://zinergia-xxx.vercel.app
✅ Production: https://zinergia.vercel.app
```

---

## 8️⃣ VERIFICACIÓN POST-DEPLOY

### Paso 8.1: Test en Producción

Abre: `https://zinergia.vercel.app/dashboard/simulator`

1. ✅ Página carga sin errores
2. ✅ Prueba subir factura real
3. ✅ Prueba exportación PDF
4. ✅ Prueba exportación Excel
5. ✅ Verifica gráficos funcionan

### Paso 8.2: Monitorizar Logs

En Vercel Dashboard:
1. Ve a: Logs
2. Filtra por: `simulator` o `webhook`
3. Busca errores 4xx o 5xx
4. Revisa logs de auditoría

---

## 📞 SOPORTE TÉCNICO

### Pregunta 1: ¿Cómo verifico si las tablas se crearon?

**Respuesta:**
1. Supabase Dashboard → Table Editor
2. Buscar tablas: `simulation_history`, `shared_simulations`
3. Click en cada tabla para ver estructura
4. Verifica índices en "Indexes"

### Pregunta 2: ¿Cómo genero API key segura?

**Respuesta:**
```bash
# Opción 1 (Recomendada)
openssl rand -hex 32

# Opción 2 (PowerShell)
[Convert]::ToHex((1..32 | % { [byte]::new())))

# Opción 3 (Online)
https://randomkeygen.com/ 64 chars hex
```

### Pregunta 3: ¿Cómo configuro development vs production?

**Respuesta:**
- Development: Usa datos mock cuando webhook falla
- Production: Debería fallar si webhook falla (no fallback)
- Modo demo: Solo visible en NODE_ENV=development

### Pregunta 4: ¿Cómo aumento el límite de rate limiting?

**Respuesta:**
Edita `/api/webhooks/*/route.ts`:
```typescript
const maxRequests = 20; // Aumentar desde 10
```

---

## 🎯 RESUMEN RÁPIDO

### Archivo `.env.local` necesario:
```env
WEBHOOK_API_KEY=tu-key-de-64-caracteres-hex
OCR_WEBHOOK_URL=https://...
COMPARISON_WEBHOOK_URL=https://...
```

### Ejecutar en Supabase SQL Editor:
```sql
-- Todo el contenido de
supabase_migrations_simulator.sql
```

### Comando de deploy:
```bash
vercel --prod
```

---

## 🔗 RECURSOS ÚTILES

- Documentación completa: `docs/SIMULATOR_SECURITY_ANALYSIS.md`
- Guía de configuración: `docs/SIMULATOR_SECURITY_SETUP.md`
- Checklist de implementación: `SECURITY_IMPLEMENTATION_CHECKLIST.md`
- Estado de implementación: `FASE_2_3_IMPLEMENTATION_STATUS.md`

---

## ✅ Listo para Verificar Funcionamiento

Una vez configurado, verifica:

- [ ] Subir PDF → Datos extraídos correctamente
- [ ] Comparar tarifas → 3 propuestas aparecen
- [ ] Exportar PDF → Descarga archivo profesional
- [ ] Exportar Excel → Descarga spreadsheet
- [ ] Ver gráficos → Barras, circular, líneas
- [ ] Compartir → Link único generado
- [ ] Historial → Guarda simulaciones pasadas
- [ ] Anomalías → Alertas inteligentes
- [ ] Comparador múltiple → Compara 3 facturas

---

¿Necesitas ayuda con algún paso específico o has encontrado algún problema?

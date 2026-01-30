# 📚 Guía de Configuración - Seguridad del Simulador

## 🚀 Instalación Completa

### 1. Instalar Dependencias

```bash
npm install zod
```

### 2. Configurar Variables de Entorno

Crea el archivo `.env.local` en la raíz del proyecto:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores reales:

```env
# Webhook URLs (ocultas en servidor)
OCR_WEBHOOK_URL=https://sswebhook.iawarrior.com/webhook/cee8e0d1-b537-4939-b54e-6255fa9776cc
COMPARISON_WEBHOOK_URL=https://sswebhook.iawarrior.com/webhook/effcc85b-5122-4896-9f0c-810e724e12c3

# Generar API Key única
WEBHOOK_API_KEY=tu-api-key-generada-aqui
```

### 3. Generar API Key Segura

**Opción A: Con OpenSSL (Recomendado)**
```bash
openssl rand -hex 32
# Ejemplo: a1b2c3d4e5f6...64 caracteres hexadecimales
```

**Opción B: Con Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Opción C: En la aplicación**
```typescript
import { generateAPIKey } from '@/services/webhookService';

const key = generateAPIKey(); // Genera key de 64 caracteres hex
```

### 4. Configurar Variables de Entorno en Vercel

Si haces deploy a Vercel, agrega las variables:

```bash
vercel env add OCR_WEBHOOK_URL
vercel env add COMPARISON_WEBHOOK_URL
vercel env add WEBHOOK_API_KEY
```

O desde el Dashboard:
1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto → Settings → Environment Variables
3. Agrega las variables para todos los entornos (Development, Preview, Production)

---

## 🔐 Características de Seguridad Implementadas

### 1. **Proxy API para Webhooks**
- ✅ URLs ocultas en código servidor
- ✅ Autenticación con API keys
- ✅ Rate limiting por IP
- ✅ Timeouts configurados (30s)
- ✅ Validación de archivos

### 2. **Validación Estricta con Zod**
- ✅ Schema validation para requests
- ✅ Schema validation para responses
- ✅ Sanitización de datos
- ✅ Prevención de inyección de código

### 3. **Validación de Archivos**
- ✅ Magic number validation (PDF signature)
- ✅ Límite de tamaño (10MB)
- ✅ Validación de MIME type
- ✅ Prevención de archivos maliciosos

### 4. **Logs Seguros**
- ✅ Sin PII en logs del cliente
- ✅ Sin datos sensibles en consola
- ✅ Logs anonimizados en servidor
- ✅ Solo metadatos relevantes

### 5. **Indicador de Modo Demo**
- ✅ Alerta visible cuando usa datos mock
- ✅ Solo en development mode
- ✅ Desaparece en producción
- ✅ Usuario sabe que son datos de prueba

### 6. **Rate Limiting**
- ✅ OCR: 10 requests/minuto por IP
- ✅ Comparison: 20 requests/minuto por IP
- ✅ Prevención de abuso
- ✅ Protección DDoS básica

---

## 🧪 Testing

### Test Local con Datos Reales

```bash
npm run dev
```

Abre: http://localhost:3000/dashboard/simulator

### Test de Validación de Archivos

Intenta subir:
- ✅ PDF válido → Debe procesar
- ❌ Archivo > 10MB → Error: "El archivo excede 10MB"
- ❌ Archivo no-PDF → Error: "Solo se permiten archivos PDF"
- ❌ PDF corrupto → Error: "Archivo PDF inválido"

### Test de Rate Limiting

Sube más de 10 archivos en 1 minuto → Error: "Rate limit exceeded"

### Test de Modo Demo

En development, si el webhook falla, verás una alerta amarilla:
```
⚠️ Modo Demostración - Los resultados son datos de prueba
```

---

## 📊 Comparativa de Seguridad

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Webhooks** | Expuestos en cliente | Ocultos en servidor |
| **Autenticación** | Ninguna | API Key required |
| **Rate Limiting** | No | 10-20 req/min por IP |
| **Validación** | Básica | Zod schema + sanitización |
| **Archivos** | Sin validación | Magic number + tamaño + tipo |
| **Logs** | PII visible | Logs anonimizados |
| **Errores** | Genéricos | Específicos con código |
| **Modo Demo** | Invisible | Alerta visible |
| **Timeouts** | No configurados | 30s con AbortController |

---

## ⚙️ Configuración Avanzada

### Cambiar Límite de Rate Limiting

Edita `/api/webhooks/ocr/route.ts`:
```typescript
const windowMs = 60 * 1000; // 1 minuto
const maxRequests = 10; // Cambia este valor
```

### Cambiar Timeout

Edita ambos archivos `/api/webhooks/*/route.ts`:
```typescript
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s
// Cambia a 60000 para 1 minuto, etc.
```

### Agregar Redis para Rate Limiting (Producción)

Para rate limiting distribuido:
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function checkRateLimit(ip: string): Promise<boolean> {
    const key = `ratelimit:${ip}`;
    const count = await redis.incr(key);
    
    if (count === 1) {
        await redis.expire(key, 60); // 60 segundos
    }
    
    return count <= 10; // Max 10 requests
}
```

---

## 🚨 Troubleshooting

### Error: "Invalid API key"

**Causa**: API key no coincide o no está configurada

**Solución**:
```bash
# Verifica que .env.local existe
cat .env.local | grep WEBHOOK_API_KEY

# Regenera la key
openssl rand -hex 32

# Actualiza .env.local y reinicia el servidor
npm run dev
```

### Error: "Rate limit exceeded"

**Causa**: Demasiadas requests en poco tiempo

**Solución**:
- Espera 1 minuto
- Reduce la frecuencia de llamadas
- Aumenta el límite si es necesario

### Error: "File too large"

**Causa**: Archivo excede 10MB

**Solución**:
- Comprime el PDF
- Reduce el número de páginas
- Aumenta MAX_SIZE en el código si es necesario

### Error: "Invalid PDF"

**Causa**: Archivo corrupto o no es PDF real

**Solución**:
- Verifica que el archivo sea PDF válido
- Abre el PDF en un visor para confirmar
- Intenta regenerar el PDF desde la fuente

---

## ✅ Checklist Pre-Producción

Antes de hacer deploy a producción:

- [ ] Variables de entorno configuradas
- [ ] API key generada y segura
- [ ] Rate limiting configurado
- [ ] Logs sin PII verificados
- [ ] Validación de archivos probada
- [ ] Timeout configurado
- [ ] Modo demo solo en development
- [ ] Error handling probado
- [ ] Documentación actualizada
- [ ] Equipo entrenado

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs del servidor
2. Verifica las variables de entorno
3. Consulta `docs/SIMULATOR_SECURITY_ANALYSIS.md`
4. Abre un issue en GitHub

---

## 🔄 Próximos Pasos

Una vez completada la seguridad crítica, puedes pasar a:

- **Fase 2**: Funcionalidades core (caché, reintentos, historial)
- **Fase 3**: UX Premium (comparador múltiple, gráficos, compartir)

Revisa el roadmap completo en `docs/SIMULATOR_SECURITY_ANALYSIS.md`

# 🚀 Guía de Deploy a Vercel

## Paso 1: Iniciar Deploy

Ejecuta este comando en tu terminal:

```bash
vercel
```

## Paso 2: Responde a las Prompts

Vercel te hará estas preguntas:

### 1. Set up and deploy?
**Respuesta**: `Y` (Yes)

### 2. Which scope do you want to deploy to?
- Selecciona tu cuenta de GitHub o email
- Usa las flechas ↑↓ para navegar
- Presiona Enter para seleccionar

### 3. Link to existing project?
**Respuesta**: `N` (No) - Es un nuevo proyecto

### 4. What's your project's name?
**Respuesta**: `zinergia` (o presiona Enter para usar el default)

### 5. In which directory is your code located?
**Respuesta**: Presiona Enter (directorio actual `./`)

### 6. Want to override the settings?
**Respuesta**: `N` (No) - Vercel detectará Next.js automáticamente

## Paso 3: Espera el Build

Vercel hará:
- ✅ Detect Next.js framework
- ✅ Install dependencies
- ✅ Build application
- ✅ Deploy to production

**Tiempo estimado**: 2-3 minutos

## Paso 4: Configurar Variables de Entorno

Durante el deploy, Vercel detectará tus variables de entorno desde `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key_de_supabase
```

**IMPORTANTE**: Verifica que estas variables estén configuradas correctamente en:
- Dashboard de Vercel → Project → Settings → Environment Variables

## Paso 5: Confirmar Deploy

Al finalizar verás:
```
✅ Production: https://zinergia.vercel.app
```

## 🎯 Post-Deploy Checklist

### 1. Verificar Deploy
- Visita: `https://zinergia.vercel.app`
- Revisa que todas las páginas carguen

### 2. Test Critical Flows
- [ ] Login funciona
- [ ] Dashboard carga correctamente
- [ ] Dark mode toggle funciona
- [ ] Navegación por teclado funciona

### 3. Verificar Variables de Entorno
En Vercel Dashboard:
```
Settings → Environment Variables
```
Debes tener:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Configurar Dominio Personal (Opcional)
```
Settings → Domains → Add Domain
```

## 🛠️ Comandos Útiles

### Ver logs del deploy
```bash
vercel logs
```

### Deploy a producción
```bash
vercel --prod
```

### Listar proyectos
```bash
vercel list
```

### Abrir proyecto en navegador
```bash
vercel open
```

## ⚠️ Troubleshooting

### Error: "Missing environment variables"
Solución:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Error: "Build failed"
Solución:
- Revisa logs en Vercel Dashboard
- Verifica que todas las dependencias estén instaladas
- Ejecuta `npm run build` localmente

### Error: "Supabase connection failed"
Solución:
- Verifica las variables de entorno
- Asegúrate de que Supabase esté corriendo
- Revisa la URL y el ANON KEY

## 📱 Vercel Dashboard

Visita: https://vercel.com/dashboard
Verás:
- Estado del deploy
- Métricas de rendimiento
- Logs de errores
- Configuración del proyecto

## 🚀 ¿Listo?

Ejecuta ahora: `vercel`

Sigue las prompts y tu app estará online en minutos!

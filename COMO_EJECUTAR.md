# 📖 GUÍA PASO A PASO - Ejecutar Script en Supabase

## 🎯 Objetivo
Ejecutar el archivo `supabase_fix_tarifas.sql` en tu base de datos de Supabase para cargar las 34 tarifas eléctricas.

---

## 🚀 PASO 1: Abrir Supabase

### Opción A: Click directo (más fácil)
1. Haz clic aquí: **https://jycwgzdrysesfcxgrxwg.supabase.co**
2. Inicia sesión con tu email y contraseña

### Opción B: Manual
1. Ve a **https://supabase.com**
2. Haz clic en **"Sign In"** (arriba a la derecha)
3. Entra con tu email y contraseña
4. En el dashboard, busca tu proyecto: **jycwgzdrysesfcxgrxwg**

---

## 📂 PASO 2: Abrir el SQL Editor

### En el dashboard de Supabase:

1. **Mira en el menú de la izquierda** (barra lateral oscura)
2. Busca el ícono que parece una **consola** o **terminal** 📟
3. Debajo dice **"SQL Editor"**
4. Haz clic ahí

> **¿No lo encuentras?** Está cerca del fondo del menú izquierdo, entre "Database" y "Settings"

---

## 📝 PASO 3: Crear Nueva Query

### Dentro del SQL Editor:

1. Busca un botón que dice **"New query"** o **"+"** (arriba a la izquierda)
2. Haz clic en **"New query"**
3. Aparecerá una pantalla blanca grande para escribir código

---

## 📋 PASO 4: Copiar el Script

### En tu computadora:

1. Ve a la carpeta de tu proyecto: **`C:\Users\Usuario\.gemini\antigravity\playground\zinergia`**
2. Busca el archivo: **`supabase_fix_tarifas.sql`**
3. Ábrelo con cualquier editor de texto (VS Code, Notepad, etc.)
4. **Selecciona TODO** el contenido del archivo
   - En Windows: `Ctrl + E` y luego `Ctrl + A` (o solo `Ctrl + A`)
   - O con el mouse: Clic al inicio, mantén presionado Shift, clic al final
5. **Copia** el contenido:
   - En Windows: `Ctrl + C`
   - O clic derecho > **Copy**

> **El archivo debe empezar con:** `-- =============================================`
> **El archivo debe terminar con:** `LIMIT 10;`

---

## 📌 PASO 5: Pegar en Supabase

### De vuelta en el SQL Editor de Supabase:

1. Haz clic dentro de la pantalla blanca grande
2. **Pega** el contenido:
   - En Windows: `Ctrl + V`
   - O clic derecho > **Paste**

Deberías ver mucho código que empieza con:
```sql
-- =============================================
-- ZINERGIA - FIX: COLUMNAS FALTANTES EN TARIFAS
-- =============================================
```

---

## ▶️ PASO 6: Ejecutar el Script

### En el SQL Editor:

1. Busca un botón que dice **"Run"** (abajo a la derecha o arriba a la derecha)
2. Puedes también presionar: **`Ctrl + Enter`**
3. Espera unos segundos...

> **Si sale un popup de confirmación:** Haz clic en **"Run"** o **"Execute"**

---

## ✅ PASO 7: Verificar Resultados

### Si todo funcionó bien:

Verás **DOS tablas de resultados** debajo del código:

#### TABLA 1 - Conteo de registros:
```
table_name              | record_count
------------------------|--------------
lv_zinergia_tarifas     | 34
v_active_tariffs        | 34
v_tariff_stats          | 6
```

#### TABLA 2 - Muestra de tarifas:
```
company         | tariff_name        | tariff_type | offer_type
----------------|--------------------|-------------|-----------
Endesa          | Conecta 3.0TD      | 3.0TD       | fixed
Endesa          | Conecta 3.1TD      | 3.1TD       | fixed
GANA ENERGIA    | 24 HRS             | 2.0TD       | fixed
GANA ENERGIA    | 3 PERIODOS         | 2.0TD       | fixed
WEKIWI          | IMPULSA ENERGIA    | 2.0TD       | fixed
...
```

**¡Si ves esto, TODO FUNCIONÓ!** 🎉

---

## ❌ Si Hay Errores

### Error rojo arriba:

Si ves un mensaje de error en rojo:

1. **Lee el mensaje de error** (quizás dice que ya existe algo)
2. **Toma una captura de pantalla** del error
3. **Ejecuta esto primero** (copia y pega, luego Run):

```sql
-- Borrar todo y empezar de cero
DROP TABLE IF EXISTS lv_zinergia_tarifas CASCADE;
DROP VIEW IF EXISTS v_active_tariffs;
DROP VIEW IF EXISTS v_tariff_stats;
```

4. Luego **vuelve al PASO 4** y ejecuta el script completo otra vez

---

## 🔍 PASO 8: Verificación Extra (Opcional)

### Para asegurarte de que todo está bien:

En el SQL Editor, crea una nueva query y ejecuta:

```sql
SELECT COUNT(*) as total_tarifas 
FROM lv_zinergia_tarifas;
```

**Resultado esperado:** `34`

---

## 📱 PASO 9: Verificar en tu App

### En tu terminal (comando):

1. Abre una terminal en tu carpeta del proyecto
2. Ejecuta:
   ```bash
   npm run supabase:verify
   ```

**Resultado esperado:**
```
✅ lv_zinergia_tarifas (34 tarifas encontradas)
✅ v_active_tariffs (34 tarifas activas)
✅ tariff_types
✅ tariff_companies

Resultado: 4/4 checks pasaron
🎉 ¡Todo configurado correctamente!
```

---

## 🎬 PASO 10: Probar el Simulador

1. Inicia tu app:
   ```bash
   npm run dev
   ```

2. Abre tu navegador:
   ```
   http://localhost:3000/dashboard/simulator
   ```

3. Sube una factura de prueba y verifica que se carguen las tarifas

---

## 🎯 Checklist de Verificación

Antes de terminar, verifica:

- [ ] Ejecutaste el script en Supabase sin errores
- [ ] Viste 34 registros en la primera tabla
- [ ] Viste tarifas de muestra en la segunda tabla
- [ ] Ejecutaste `npm run supabase:verify` y pasó
- [ ] El simulador funciona en la app

---

## 📞 ¿Necesitas Ayuda?

### Si algo no funciona:

1. **Verifica que estás en el proyecto correcto:**
   - URL debe ser: `jycwgzdrysesfcxgrxwg.supabase.co`

2. **Verifica que copiaste TODO el archivo:**
   - El archivo debe empezar con `-- =============================================`
   - El archivo debe terminar con `LIMIT 10;`

3. **Verifica que no haya errores rojos:**
   - Si hay errores, léelos con atención
   - La mayoría de las veces dice "already exists" y es normal

4. **Intenta la opción nuclear (borrar todo y empezar de cero):**
   ```sql
   DROP TABLE IF EXISTS lv_zinergia_tarifas CASCADE;
   DROP VIEW IF EXISTS v_active_tariffs;
   DROP VIEW IF EXISTS v_tariff_stats;
   ```
   Luego ejecuta el script completo otra vez

---

## 📸 Guía Visual

```
┌─────────────────────────────────────────┐
│  SUPABASE DASHBOARD                     │
├─────────────────────────────────────────┤
│  🏠 Home   │                            │
│  📊 Database │                          │
│  ┇                                        │
│  📟 SQL Editor  ← HAZ CLIC AQUÍ         │
│  ┇                                        │
│  ⚙️ Settings                            │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  SQL EDITOR                              │
├─────────────────────────────────────────┤
│  [+ New query]  ← HAZ CLIC AQUÍ        │
├─────────────────────────────────────────┤
│                                         │
│  (Aquí pegas el SQL)                    │
│                                         │
│                                         │
│                                         │
│  [Run] ← HAZ CLIC AQUÍ O CTRL+ENTER    │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  RESULTADOS                              │
├─────────────────────────────────────────┤
│  ✅ lv_zinergia_tarifas | 34           │
│  ✅ v_active_tariffs    | 34           │
│  ✅ v_tariff_stats      | 6            │
│                                         │
│  company  | tariff  | type  | offer    │
│  Endesa   | ...    | 3.0TD  | fixed    │
│  ...      | ...    | ...   | ...      │
└─────────────────────────────────────────┘
```

---

## ✨ ¡Listo!

Una vez que hayas ejecutado el script correctamente y visto los resultados:

1. ✅ Tienes 34 tarifas eléctricas en tu base de datos
2. ✅ Tu simulador puede usar estas tarifas
3. ✅ Todo está configurado y funcionando

**¡Felicidades!** 🎉🚀

---

## 📝 Resumen Rápido

1. Ve a: https://jycwgzdrysesfcxgrxwg.supabase.co
2. SQL Editor > New query
3. Copia contenido de `supabase_fix_tarifas.sql`
4. Pégalo en el editor
5. Click en **Run** (o Ctrl+Enter)
6. Verifica que veas 34 registros
7. Ejecuta `npm run supabase:verify`
8. ¡Disfruta! 🎉

---

**¿Sigues con problemas?** Mándame una captura de pantalla del error y te ayudo 😊

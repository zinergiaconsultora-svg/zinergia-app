# 🔧 SOLUCIÓN: Tabla lv_zinergia_tarifas ya existe

## ❌ El Error
```
ERROR: 42703: column "tariff_type" of relation "lv_zinergia_tarifas" does not exist
```

## ✅ La Solución Rápida

La tabla `lv_zinergia_tarifas` ya existe en tu base de datos pero **no tiene las columnas necesarias**.

### PASO 1: Ejecutar el Script de Corrección

1. Ve a: **https://jycwgzdrysesfcxgrxwg.supabase.co**
2. **SQL Editor** > **New query**
3. Abre el archivo: **`supabase_fix_tarifas.sql`**
4. Copia TODO el contenido
5. Pégalo en el editor
6. Haz clic en **Run** (o Ctrl+Enter)

### PASO 2: Verificar que Funcionó

Después de ejecutar el script, deberías ver:

**Resultado 1** - Conteo de registros:
```
table_name              | record_count
------------------------|--------------
lv_zinergia_tarifas     | 34
v_active_tariffs        | 34
v_tariff_stats          | 6
```

**Resultado 2** - Muestra de tarifas:
```
company         | tariff_name         | tariff_type | offer_type
----------------|---------------------|-------------|-----------
Endesa          | Conecta 3.0TD       | 3.0TD       | fixed
Endesa          | Conecta 3.1TD       | 3.1TD       | fixed
GANA ENERGIA    | 24 HRS              | 2.0TD       | fixed
...
```

## 🎯 Qué Hace el Script de Corrección

El script `supabase_fix_tarifas.sql` hace lo siguiente:

1. ✅ **Agrega columnas faltantes**:
   - `tariff_type` (2.0TD, 3.0TD, 3.1TD)
   - `offer_type` (fixed, indexed)
   - `contract_duration`
   - `fixed_fee`
   - `logo_color`
   - `description`
   - `is_active`

2. ✅ **Limpia datos antiguos** (para evitar duplicados)

3. ✅ **Inserta 34 tarifas**:
   - 24 tarifas 2.0TD
   - 5 tarifas 3.0TD
   - 5 tarifas 3.1TD

4. ✅ **Crea índices** para rendimiento

5. ✅ **Crea vistas** útiles:
   - `v_active_tariffs`
   - `v_tariff_stats`

6. ✅ **Configura RLS** (seguridad)

## 🔍 Verificación Adicional

Después de ejecutar el script, verifica con esta query:

```sql
-- Verificar estructura de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'lv_zinergia_tarifas'
ORDER BY ordinal_position;
```

Deberías ver:
- company (text)
- tariff_name (text)
- tariff_type (text) ← IMPORTANTE
- offer_type (text) ← IMPORTANTE
- power_price_p1 a p6 (numeric)
- energy_price_p1 a p6 (numeric)
- connection_fee (numeric)
- is_active (boolean)
- etc.

## 🚀 Alternativa: Recrear la Tabla

Si prefieres empezar de cero, ejecuta esto primero:

```sql
-- ELIMINAR tabla existente
DROP TABLE IF EXISTS lv_zinergia_tarifas CASCADE;
DROP VIEW IF EXISTS v_active_tariffs;
DROP VIEW IF EXISTS v_tariff_stats;

-- Luego ejecuta el script completo
-- supabase_setup_consolidated.sql
```

⚠️ **ADVERTENCIA**: Esto eliminará cualquier dato personalizado que hayas añadido.

## 📱 Verificar en la Aplicación

Después de configurar Supabase:

1. Ejecuta el verificador:
   ```bash
   npm run supabase:verify
   ```

2. O el check rápido:
   ```bash
   npm run supabase:setup:check
   ```

3. Inicia la app:
   ```bash
   npm run dev
   ```

4. Abre el simulador:
   ```
   http://localhost:3000/dashboard/simulator
   ```

## ❌ Si Sigues Teniendo Problemas

### Problema: "permission denied"
```sql
-- Ejecutar esto para arreglar permisos
GRANT SELECT ON lv_zinergia_tarifas TO authenticated;
GRANT SELECT ON v_active_tariffs TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
```

### Problema: "relation does not exist"
```sql
-- Verificar que la tabla existe
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'lv_zinergia_tarifas';
```

### Problema: "column does not exist"
```sql
-- Verificar qué columnas tiene la tabla
\d lv_zinergia_tarifas
-- O alternativamente:
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'lv_zinergia_tarifas';
```

## ✅ Checklist Completo

Después de ejecutar `supabase_fix_tarifas.sql`, verifica:

- [ ] 34 tarifas en `lv_zinergia_tarifas`
- [ ] Columna `tariff_type` existe
- [ ] Columna `offer_type` existe
- [ ] Vista `v_active_tariffs` funciona
- [ ] Vista `v_tariff_stats` funciona
- [ ] Índices creados
- [ ] RLS habilitado
- [ ] Permisos concedidos
- [ ] `npm run supabase:verify` pasa
- [ ] Simulador funciona en la app

## 🎉 Cuando Todo Funcione

Verás esto al ejecutar `npm run supabase:verify`:

```
🔍 Verificando configuración de Supabase...

📋 Verificando tabla lv_zinergia_tarifas...
   ✅ PASS - 34 tarifas encontradas

📋 Verificando vista v_active_tariffs...
   ✅ PASS - 34 tarifas activas

📋 Verificando tipos de tarifas...
   ✅ PASS - Tipos encontrados:
      2.0TD - fixed: 24
      3.0TD - fixed: 4
      3.0TD - indexed: 1
      3.1TD - fixed: 4
      3.1TD - indexed: 1

📊 RESUMEN:
✅ lv_zinergia_tarifas (34 registros)
✅ v_active_tariffs (34 registros)
✅ tariff_types
✅ tariff_companies

Resultado: 4/4 checks pasaron

🎉 ¡Todo configurado correctamente!
```

---

## 📝 Resumen

1. **NO ejecutes** `supabase_setup_consolidated.sql` (fallará porque la tabla ya existe)
2. **EJECUTA** `supabase_fix_tarifas.sql` (corrige la tabla existente)
3. **VERIFICA** con `npm run supabase:verify`
4. **DISFRUTA** del simulador con 34 tarifas reales 🚀

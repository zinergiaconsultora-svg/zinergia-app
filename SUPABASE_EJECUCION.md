# 🚀 Ejecución Rápida - Supabase Setup

## 📋 Instrucciones Paso a Paso

### Paso 1: Abrir el SQL Editor de Supabase

1. Ve a: **https://jycwgzdrysesfcxgrxwg.supabase.co**
2. Inicia sesión con tu cuenta
3. En el menú izquierdo, haz clic en **"SQL Editor"** (ícono de consola)
4. Haz clic en **"New query"** para crear una nueva consulta

### Paso 2: Ejecutar el Script

1. Abre el archivo: **`supabase_setup_consolidated.sql`**
2. Copia **TODO** el contenido del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **"Run"** (o presiona `Ctrl + Enter`)

### Paso 3: Verificar la Instalación

Después de ejecutar el script, deberías ver:

**Tabla de resultados 1** - Verificación:
```
table_name              | record_count
------------------------|--------------
lv_zinergia_tarifas     | 34
v_active_tariffs        | 34
v_tariff_stats          | 6
```

**Tabla de resultados 2** - Ejemplo de tarifas:
```
company         | tariff_name           | tariff_type | offer_type
----------------|-----------------------|-------------|-----------
Endesa          | Conecta 3.0TD         | 3.0TD       | fixed
Endesa          | Conecta 3.1TD         | 3.1TD       | fixed
GANA ENERGIA    | 24 HRS                | 2.0TD       | fixed
GANA ENERGIA    | 3 PERIODOS            | 2.0TD       | fixed
...
```

### ✅ Si ves estos resultados, ¡todo funcionó correctamente!

---

## 🔍 Verificación Adicional

Puedes ejecutar estas consultas adicionales para verificar todo:

### 1. Ver todas las tarifas activas
```sql
SELECT * FROM v_active_tariffs;
```
**Resultado esperado**: 34 filas con todas las tarifas

### 2. Ver estadísticas de tarifas
```sql
SELECT * FROM v_tariff_stats ORDER BY tariff_type, offer_type;
```
**Resultado esperado**: 
- 2.0TD fixed: ~24 tarifas
- 3.0TD fixed: ~4 tarifas
- 3.0TD indexed: ~1 tarifa
- 3.1TD fixed: ~4 tarifas
- 3.1TD indexed: ~1 tarifa

### 3. Contar tarifas por tipo
```sql
SELECT 
    tariff_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE offer_type = 'fixed') as fixed_count,
    COUNT(*) FILTER (WHERE offer_type = 'indexed') as indexed_count
FROM lv_zinergia_tarifas
WHERE is_active = TRUE
GROUP BY tariff_type
ORDER BY tariff_type;
```

**Resultado esperado**:
```
tariff_type | total | fixed_count | indexed_count
------------|-------|-------------|--------------
2.0TD       | 24    | 24          | 0
3.0TD       | 5     | 4           | 1
3.1TD       | 5     | 4           | 1
```

### 4. Verificar índices creados
```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename LIKE '%tarifa%' OR tablename LIKE '%client%' OR tablename LIKE '%proposal%'
ORDER BY tablename, indexname;
```

**Resultado esperado**: Múltiples índices para optimización

---

## 🎯 Verificar en la Aplicación

Después de ejecutar el script en Supabase:

1. **Inicia tu aplicación local**:
   ```bash
   npm run dev
   ```

2. **Abre el simulador**:
   - Ve a: `http://localhost:3000/dashboard/simulator`
   - Sube una factura de prueba
   - Verifica que se carguen las tarifas

3. **Verifica en la consola del navegador**:
   ```javascript
   // Abre las DevTools (F12) y ejecuta:
   fetch('https://jycwgzdrysesfcxgrxwg.supabase.co/rest/v1/lv_zinergia_tarifas?is_active=eq.true', {
     headers: {
       'apikey': 'TU_ANON_KEY',
       'Authorization': 'Bearer TU_ANON_KEY'
     }
   })
   .then(r => r.json())
   .then(data => console.log('Tarifas cargadas:', data.length));
   ```
   
   **Resultado esperado**: `Tarifas cargadas: 34`

---

## ❌ Solución de Problemas

### Error: "permission denied for table lv_zinergia_tarifas"

**Causa**: Las políticas RLS no se aplicaron correctamente

**Solución**:
```sql
-- Ejecutar esto en el SQL Editor
ALTER TABLE lv_zinergia_tarifas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active tariffs" ON lv_zinergia_tarifas;
CREATE POLICY "Authenticated users can view active tariffs"
    ON lv_zinergia_tarifas FOR SELECT 
    USING (auth.uid() IS NOT NULL AND is_active = TRUE);

GRANT SELECT ON lv_zinergia_tarifas TO authenticated;
GRANT SELECT ON v_active_tariffs TO authenticated;
```

### Error: "relation does not exist"

**Causa**: La tabla no se creó correctamente

**Solución**:
```sql
-- Verificar si la tabla existe
SELECT * FROM pg_tables WHERE tablename = 'lv_zinergia_tarifas';

-- Si no existe, ejecutar solo la PARTE 1 del script
```

### Error: "column does not exist"

**Causa**: Falta alguna columna en la tabla

**Solución**:
```sql
-- Añadir columnas faltantes
ALTER TABLE lv_zinergia_tarifas
    ADD COLUMN IF NOT EXISTS logo_color TEXT DEFAULT 'bg-slate-600',
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
```

---

## 📊 Resumen de lo que se Instala

### Tablas
- ✅ `lv_zinergia_tarifas` - 34 tarifas eléctricas

### Vistas
- ✅ `v_active_tariffs` - Tarifas activas para la app
- ✅ `v_tariff_stats` - Estadísticas por tipo
- ✅ `v_franchise_client_stats` - Estadísticas de franquicias
- ✅ `v_proposal_funnel` - Embudo de propuestas
- ✅ `v_top_performers` - Top agentes y franquicias

### Índices (20+)
- ✅ Optimización de tarifas
- ✅ Optimización de clientes
- ✅ Optimización de propuestas
- ✅ Optimización de comisiones

### Funciones
- ✅ `cleanup_expired_invitations()` - Limpieza de invitations
- ✅ `check_data_integrity()` - Verificación de datos
- ✅ `update_updated_at_column()` - Auto-update timestamps

---

## 🎉 Checklist de Verificación

Ejecuta esto para verificar todo en una sola consulta:

```sql
WITH verification AS (
    -- 1. Tarifas
    SELECT 'lv_zinergia_tarifas' as item, 
           CASE WHEN COUNT(*) >= 34 THEN '✅ PASS' ELSE '❌ FAIL' END as status
    FROM lv_zinergia_tarifas
    
    UNION ALL
    
    -- 2. Vista activa
    SELECT 'v_active_tariffs', 
           CASE WHEN COUNT(*) >= 34 THEN '✅ PASS' ELSE '❌ FAIL' END
    FROM v_active_tariffs
    
    UNION ALL
    
    -- 3. Vista stats
    SELECT 'v_tariff_stats', 
           CASE WHEN COUNT(*) >= 3 THEN '✅ PASS' ELSE '❌ FAIL' END
    FROM v_tariff_stats
    
    UNION ALL
    
    -- 4. Índices de tarifas
    SELECT 'idx_tarifas_company', 
           CASE WHEN COUNT(*) >= 1 THEN '✅ PASS' ELSE '❌ FAIL' END
    FROM pg_indexes WHERE indexname = 'idx_tarifas_company'
    
    UNION ALL
    
    -- 5. RLS enabled
    SELECT 'rls_enabled', 
           CASE WHEN relrowsecurity THEN '✅ PASS' ELSE '❌ FAIL' END
    FROM pg_class WHERE relname = 'lv_zinergia_tarifas'
)
SELECT * FROM verification ORDER BY item;
```

**Resultado esperado**: Todo en ✅ PASS

---

## 📝 Notas Importantes

1. **No elimines la tabla `offers`** - Todavía se usa para ofertas personalizadas
2. **El servicio crmService** ya está actualizado para usar `lv_zinergia_tarifas`
3. **Las tarifas se cachean** - Si no ves cambios, recarga la aplicación
4. **RLS está activado** - Solo usuarios autenticados pueden ver las tarifas

---

## 🔄 Actualizaciones Futuras

Para añadir más tarifas en el futuro:

```sql
INSERT INTO lv_zinergia_tarifas (
    company, tariff_name, tariff_type, 
    power_price_p1, power_price_p2, power_price_p3,
    energy_price_p1, energy_price_p2, energy_price_p3,
    connection_fee
) VALUES (
    'Nueva Compañía', 'Nueva Tarifa', '2.0TD',
    0.085, 0.085, 0.085,
    0.125, 0.125, 0.125,
    0.6
);
```

---

## 💾 Backup

Antes de ejecutar, considera hacer un backup:

```sql
-- Exportar datos actuales
pg_dump -h jycwgzdrysesfcxgrxwg.supabase.co -U postgres -d postgres > backup_pre_tarifas.sql
```

---

## ✨ Listo

Una vez ejecutado todo correctamente, tu aplicación tendrá:
- ✅ 34 tarifas eléctricas del mercado español
- ✅ Soporte para 2.0TD, 3.0TD y 3.1TD
- ✅ Optimizaciones de rendimiento
- ✅ Vistas de analytics
- ✅ Todo integrado con el simulador

¡Ahora puedes usar el simulador con datos reales! 🎉

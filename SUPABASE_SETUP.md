# Guía de Instalación y Configuración de Supabase

## 📋 Índice
1. [Scripts Disponibles](#scripts-disponibles)
2. [Orden de Ejecución](#orden-de-ejecución)
3. [Tablas y Vistas](#tablas-y-vistas)
4. [Mantenimiento](#mantenimiento)
5. [Solución de Problemas](#solución-de-problemas)

---

## 🗂️ Scripts Disponibles

### 1. `supabase_tarifas_setup.sql`
**Descripción**: Configura la tabla principal de tarifas eléctricas `lv_zinergia_tarifas`

**Contenido**:
- Creación de tabla `lv_zinergia_tarifas` con soporte para 2.0TD, 3.0TD y 3.1TD
- Inserción de 34 tarifas reales del mercado español
- Configuración de RLS (Row Level Security)
- Vistas útiles: `v_active_tariffs` y `v_tariff_stats`
- Triggers para `updated_at`

**Ejecutar**: Una vez para setup inicial o cuando se necesiten actualizar las tarifas

---

### 2. `supabase_complete_review.sql`
**Descripción**: Revisión completa y optimización de la base de datos

**Contenido**:
- Fixes y mejoras en tablas existentes
- Índices de rendimiento para todas las tablas principales
- Vistas para analytics y dashboard
- Funciones auxiliares para cálculos
- Checks de integridad de datos
- Actualización de políticas de seguridad

**Ejecutar**: Después de setup inicial o cuando se necesiten optimizaciones

---

### 3. Scripts Legacy (existentes)
- `supabase_offers_setup.sql` - Configuración de ofertas personalizadas
- `supabase_network_setup.sql` - Configuración de red de franquicias
- `supabase_sprint3_setup.sql` - Comisiones y gamificación
- `supabase_proposals_setup.sql` - Propuestas
- `supabase_fix_profiles.sql` - Fixes de perfiles

---

## 🚀 Orden de Ejecución

### Instalación Inicial (Nueva Base de Datos)

1. **Configuración básica**:
   ```bash
   # Ejecutar en este orden:
   supabase_fix_profiles.sql
   supabase_network_setup.sql
   supabase_offers_setup.sql
   supabase_proposals_setup.sql
   supabase_sprint3_setup.sql
   ```

2. **Tarifas**:
   ```bash
   supabase_tarifas_setup.sql
   ```

3. **Optimizaciones**:
   ```bash
   supabase_complete_review.sql
   ```

### Actualización de Base de Datos Existente

Si ya tienes una base de datos funcionando:

1. **Backup primero**:
   ```sql
   -- Exportar datos importantes
   pg_dump -h your-db.supabase.co -U postgres -d postgres > backup.sql
   ```

2. **Ejecutar scripts de actualización**:
   ```bash
   # Solo si la tabla lv_zinergia_tarifas no existe
   supabase_tarifas_setup.sql
   
   # Para optimizaciones y fixes
   supabase_complete_review.sql
   ```

---

## 📊 Tablas y Vistas

### Tablas Principales

| Tabla | Descripción | Registros |
|-------|-------------|-----------|
| `lv_zinergia_tarifas` | Tarifas eléctricas maestras | 34 |
| `profiles` | Usuarios (admin/franchise/agent) | Variable |
| `clients` | Clientes de energía | Variable |
| `proposals` | Propuestas de ahorro | Variable |
| `offers` | Ofertas personalizadas por franquicia | Variable |
| `network_commissions` | Comisiones de red | Variable |
| `user_points` | Puntos de gamificación | Variable |
| `network_invitations` | Invitaciones a la red | Variable |

### Vistas Útiles

#### `v_active_tariffs`
Tarifas activas para uso en la aplicación:
```sql
SELECT * FROM v_active_tariffs;
```

#### `v_tariff_stats`
Estadísticas agregadas por tipo de tarifa:
```sql
SELECT * FROM v_tariff_stats;
```

#### `v_franchise_client_stats`
Estadísticas de clientes por franquicia:
```sql
SELECT * FROM v_franchise_client_stats;
```

#### `v_proposal_funnel`
Embudo de propuestas de últimos 30 días:
```sql
SELECT * FROM v_proposal_funnel;
```

#### `v_top_performers`
Top 20 agentes/franquicias por rendimiento:
```sql
SELECT * FROM v_top_performers;
```

#### `v_tariffs_summary`
Resumen de tarifas por compañía y tipo:
```sql
SELECT * FROM v_tariffs_summary;
```

---

## 🔧 Mantenimiento

### Funciones de Mantenimiento Disponibles

#### 1. Limpieza de Invitaciones Expiradas
```sql
SELECT cleanup_expired_invitations();
-- Retorna: número de invitaciones eliminadas
```

#### 2. Actualización de Puntos de Actividad
```sql
SELECT update_activity_scores();
-- Actualiza puntos basados en actividad reciente
```

#### 3. Check de Integridad de Datos
```sql
SELECT * FROM check_data_integrity();
-- Retorna: registros huérfanos o problemáticos
```

#### 4. Análisis de Consultas Lentas
```sql
SELECT * FROM get_slow_queries(1000);
-- Muestra consultas con más de 1000ms de tiempo promedio
```

### Tareas Programadas Sugeridas

```sql
-- Crear función de mantenimiento programado
CREATE OR REPLACE FUNCTION scheduled_maintenance()
RETURNS VOID AS $$
BEGIN
    -- Limpiar invitaciones viejas
    PERFORM cleanup_expired_invitations();
    
    -- Actualizar puntos de actividad
    PERFORM update_activity_scores();
    
    -- Log de mantenimiento
    INSERT INTO maintenance_logs (executed_at, actions_taken)
    VALUES (NOW(), 'cleanup_expired_invitations, update_activity_scores');
END;
$$ LANGUAGE plpgsql;

-- Programar para ejecutar cada día (requiere pg_cron extension)
-- SELECT cron.schedule('daily-maintenance', '0 2 * * *', 'SELECT scheduled_maintenance();');
```

---

## 🔍 Solución de Problemas

### Problema: La tabla `lv_zinergia_tarifas` no existe

**Solución**:
```sql
-- Ejecutar el script de setup de tarifas
\i supabase_tarifas_setup.sql
```

### Problema: Error de permisos en vistas

**Solución**:
```sql
-- Asegurarse de que los permisos estén correctos
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL VIEWS IN SCHEMA public TO authenticated;
```

### Problema: RLS bloqueando consultas

**Solución**:
```sql
-- Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('lv_zinergia_tarifas', 'clients', 'proposals');

-- Asegurarse de que existan políticas para authenticated
```

### Problema: Consultas lentas

**Solución**:
```sql
-- Usar la función de análisis
SELECT * FROM get_slow_queries(500);

-- Verificar que los índices existan
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Problema: Datos inconsistentes

**Solución**:
```sql
-- Ejecutar check de integridad
SELECT * FROM check_data_integrity();

-- Si hay registros huérfanos, eliminarlos manualmente
-- Ejemplo para clientes sin franquicia válida
DELETE FROM clients
WHERE franchise_id NOT IN (SELECT id FROM franchises)
AND franchise_id IS NOT NULL;
```

---

## 📈 Monitoreo y Análisis

### Queries Útiles de Monitoreo

#### Tamaño de tablas:
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Conexiones activas:
```sql
SELECT 
    count(*) as connections,
    state,
    count(*) FILTER (WHERE state = 'active') as active
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;
```

#### Rendimiento de índices:
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

## 🔄 Sincronización con la Aplicación

### Actualización del Servicio CRM

El servicio `crmService.ts` ya está actualizado para usar `lv_zinergia_tarifas`:

```typescript
// En src/services/crmService.ts
async getOffers(): Promise<Offer[]> {
    const { data, error } = await supabase
        .from('lv_zinergia_tarifas')
        .select('*')
        .eq('is_active', true)
        .order('company', { ascending: true });
    
    // Mapeo de datos...
}
```

### Verificar que Funciona

```typescript
// En el navegador, consola:
const { data } = await supabase.from('lv_zinergia_tarifas').select('*');
console.log('Tarifas cargadas:', data?.length);
```

---

## ✅ Checklist de Verificación

Después de ejecutar los scripts, verificar:

- [ ] Tabla `lv_zinergia_tarifas` existe con 34+ registros
- [ ] Vista `v_active_tariffs` retorna datos
- [ ] Vista `v_tariff_stats` muestra estadísticas
- [ ] Índices creados en todas las tablas principales
- [ ] Políticas RLS configuradas correctamente
- [ ] Triggers `updated_at` funcionando
- [ ] Funciones de mantenimiento accesibles
- [ ] Permisos concedidos a `authenticated`
- [ ] Application puede leer tarifas sin errores
- [ ] No hay registros huérfanos (check_data_integrity)

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa el log de errores en Supabase dashboard
2. Ejecuta `check_data_integrity()` para identificar problemas
3. Verifica que todos los scripts se ejecutaron en orden correcto
4. Revisa las políticas RLS con `SELECT * FROM pg_policies`

---

## 📝 Notas de Versión

### v1.0 (2024)
- Creación de tabla `lv_zinergia_tarifas`
- 34 tarifas del mercado español
- Soporte para 2.0TD, 3.0TD, 3.1TD
- Vistas de analytics
- Funciones de mantenimiento
- Optimización de índices

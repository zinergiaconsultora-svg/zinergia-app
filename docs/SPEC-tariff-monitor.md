# SPEC: Monitor Automático de Tarifas

## Resumen

Agente automatizado que monitoriza precios de tarifas eléctricas de las principales comercializadoras españolas y actualiza el catálogo de ofertas de Zinergia automáticamente, usando el skill `data-scraper-agent`.

## Problema

El catálogo de ofertas (`offers` table) se desactualiza porque las comercializadoras cambian precios frecuentemente. Los agentes comparan contra precios obsoletos, lo que genera propuestas inexactas y pérdida de credibilidad.

## Solución propuesta (basada en data-scraper-agent skill)

### Stack
- **Scraper**: Python + Playwright headless
- **LLM enrichment**: Gemini Flash (gratuito) para normalizar datos extraídos
- **Schedule**: GitHub Actions cron (diario/semanal)
- **Storage**: Supabase (tabla `tariff_snapshots`)
- **Feedback loop**: Admin revisa/aprueba cambios antes de que impacten comparativas

### Fuentes prioritarias
1. Naturgy (web pública de tarifas)
2. Endesa (web pública)
3. Iberdrola (web pública)
4. Repsol Electricidad
5. TotalEnergies
6. Otras comercializadoras del mercado libre

### Flujo
1. GitHub Action se ejecuta según cron
2. Scraper navega a cada web de comercializadora
3. Extrae precios de energía y potencia por período
4. LLM normaliza al esquema de `offers`
5. Compara con snapshot anterior
6. Si hay cambios → crea `tariff_update_proposal` pendiente
7. Admin recibe notificación → aprueba/rechaza
8. Si aprueba → actualiza `offers` y marca leads afectados

## Modelo de datos

```sql
CREATE TABLE tariff_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source text NOT NULL,       -- 'naturgy', 'endesa', etc.
    tariff_name text NOT NULL,
    data jsonb NOT NULL,        -- precios normalizados
    scraped_at timestamptz DEFAULT now(),
    checksum text NOT NULL      -- para detectar cambios
);

CREATE TABLE tariff_update_proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id uuid REFERENCES tariff_snapshots(id),
    offer_id uuid REFERENCES offers(id),
    diff jsonb NOT NULL,
    status text DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by uuid,
    reviewed_at timestamptz
);
```

## Fuera de alcance (v1)

- APIs directas de comercializadoras (requieren acuerdos)
- Tarifas indexadas (PVPC, pool)
- Tarifas de gas
- Comparación automática sin aprobación humana

## Criterios de aceptación

- [ ] Scraper extrae precios de al menos 3 comercializadoras
- [ ] LLM normaliza al formato de `offers` correctamente
- [ ] Detección de cambios funciona (no crea duplicados)
- [ ] Admin recibe propuesta de actualización
- [ ] Flujo de aprobación funciona end-to-end

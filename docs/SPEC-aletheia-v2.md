# SPEC: Motor Aletheia v2 — Comparativas Multi-Fuente

## Resumen

Evolucionar el motor de comparativas Aletheia para soportar múltiples fuentes de tarifas (APIs de comercializadoras, scraping regulado, CSV import manual) y generar comparativas más completas con ranking visual de opciones.

## Problema

El motor actual compara contra un catálogo estático de ofertas. Las tarifas cambian frecuentemente y el catálogo se desactualiza rápido. Los agentes pierden ventas porque las comparativas no reflejan las ofertas reales del mercado.

## Solución propuesta

1. Sistema de ingesta multi-fuente: API, CSV upload, scraping programado
2. Versionado de tarifas (snapshot por fecha)
3. Ranking visual en propuestas con top 3-5 ofertas
4. Alertas cuando una tarifa mejor esté disponible para un lead abierto

## Usuarios afectados

- [x] Admin (gestión de fuentes)
- [x] Franquicia
- [x] Agente (mejores comparativas)
- [x] Cliente (ve ranking en propuesta pública)

## Modelo de datos

- `tariff_sources`: id, name, type (api|csv|scrape), config, last_sync
- `tariff_versions`: id, source_id, tariff_id, valid_from, valid_to, data
- Evolución de `offers` existente

## Fuera de alcance

- Integración con comercializadoras por API real (requiere acuerdos)
- Contratación directa desde la plataforma

## Criterios de aceptación

- [ ] Import CSV de tarifas funciona
- [ ] Motor compara contra tarifas vigentes (por fecha)
- [ ] Propuesta muestra top 3 ofertas con ranking
- [ ] Vista pública actualizada con ranking

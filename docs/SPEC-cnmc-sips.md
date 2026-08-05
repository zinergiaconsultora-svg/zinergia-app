# SPEC: Integración CNMC/SIPS

## Resumen

Conectar con el sistema SIPS de la CNMC para obtener datos reales de consumo y potencia contratada a partir del CUPS, mejorando la precisión de las comparativas y reduciendo la dependencia del OCR de facturas.

## Problema

Actualmente los datos de consumo se extraen por OCR de la factura, lo cual es impreciso (factura de 1 mes extrapolada a 12 meses). El sistema SIPS de la CNMC proporciona datos históricos reales de consumo por CUPS que permitirían comparativas mucho más precisas.

## Solución propuesta

1. Crear un servicio `SipsClient` que consulte la API de SIPS con un CUPS
2. Obtener: consumo anual real, potencias contratadas, peajes, distribuidora
3. Integrar como fuente preferida en `resolveAnnualConsumption` (ya existe fallback)
4. Cachear resultados por CUPS con TTL de 7 días

## Usuarios afectados

- [x] Admin
- [ ] Franquicia
- [x] Agente (transparente, mejores datos)
- [ ] Cliente

## Modelo de datos

- Nueva tabla `sips_cache`: cups, data (jsonb), fetched_at, expires_at
- `ocr_jobs.sips_data` (jsonb, nullable) — snapshot por lead

## Fuera de alcance

- Consulta masiva de CUPS
- Integración con otras fuentes (REE, distribuidoras directas)

## Criterios de aceptación

- [ ] SipsClient consulta y parsea datos SIPS correctamente
- [ ] Cache funciona y se respeta TTL
- [ ] resolveAnnualConsumption usa SIPS como fuente preferida
- [ ] Fallback a OCR cuando SIPS no tiene datos
- [ ] Error handling robusto (SIPS down, CUPS inválido)

# Pruebas del Webhook de Comparación de Tarifas

## Webhook URL
```
https://sswebhook.iawarrior.com/webhook/effcc85b-5122-4896-9f0c-810e724e12c3
```

## Formato de Envío (POST)

El webhook recibe un objeto `InvoiceData` con todos los datos de la factura:

```json
{
  "period_days": 30,
  "power_p1": 19.0,
  "power_p2": 19.0,
  "power_p3": 19.0,
  "power_p4": 19.0,
  "power_p5": 19.0,
  "power_p6": 27.7,
  "energy_p1": 0,
  "energy_p2": 746.0,
  "energy_p3": 347.0,
  "energy_p4": 0,
  "energy_p5": 0,
  "energy_p6": 1298.0,
  "current_power_price_p1": 0.056274,
  "current_power_price_p2": 0.029883,
  "current_power_price_p3": 0.013081,
  "current_power_price_p4": 0.011451,
  "current_power_price_p5": 0.007654,
  "current_power_price_p6": 0.004928,
  "current_energy_price_p1": 0.00000,
  "current_energy_price_p2": 0.131482,
  "current_energy_price_p3": 0.00000,
  "current_energy_price_p4": 0.00000,
  "current_energy_price_p5": 0.00000,
  "current_energy_price_p6": 0.00000,
  "subtotal": 427.78,
  "vat": 89.83,
  "total_amount": 517.61,
  "client_name": "BELEN GONZALEZ TELLO",
  "company_name": "Endesa Energia, S.A.U.",
  "tariff_name": "3.0TD",
  "cups": "ES0021000011202138AP0F",
  "invoice_number": "P25CON055669714",
  "invoice_date": "2025-12-03",
  "supply_address": "PZ PINTOR JOSE MORALES 5 LOCAL 108, 10600 PLASENCIA, CÁCERES"
}
```

## Formato de Respuesta Esperado

### Opción 1: Formato con `output` wrapper
```json
[
  {
    "output": {
      "current_annual_cost": 6211.32,
      "offers": [
        {
          "id": "offer-1",
          "marketer_name": "Energía Plus",
          "tariff_name": "Tarifa Optimizada 3.0TD",
          "logo_color": "bg-emerald-600",
          "type": "fixed",
          "power_price": {
            "p1": 0.045,
            "p2": 0.045,
            "p3": 0.045,
            "p4": 0.045,
            "p5": 0.045,
            "p6": 0.045
          },
          "energy_price": {
            "p1": 0.18,
            "p2": 0.15,
            "p3": 0.12,
            "p4": 0.10,
            "p5": 0.08,
            "p6": 0.06
          },
          "fixed_fee": 25,
          "contract_duration": "12 meses",
          "annual_cost": 5200.00,
          "optimization_result": {
            "optimized_powers": {
              "p1": 15,
              "p2": 15,
              "p3": 15,
              "p4": 15,
              "p5": 15,
              "p6": 20
            },
            "original_annual_fixed_cost": 850.50,
            "optimized_annual_fixed_cost": 720.00,
            "annual_optimization_savings": 130.50
          }
        }
      ]
    }
  }
]
```

### Opción 2: Formato directo (sin wrapper)
```json
{
  "current_annual_cost": 6211.32,
  "offers": [
    {
      "id": "offer-1",
      "marketer_name": "Energía Plus",
      "tariff_name": "Tarifa Optimizada 3.0TD",
      "logo_color": "bg-emerald-600",
      "type": "fixed",
      "power_price": { "p1": 0.045, "p2": 0.045, "p3": 0.045, "p4": 0.045, "p5": 0.045, "p6": 0.045 },
      "energy_price": { "p1": 0.18, "p2": 0.15, "p3": 0.12, "p4": 0.10, "p5": 0.08, "p6": 0.06 },
      "fixed_fee": 25,
      "contract_duration": "12 meses",
      "annual_cost": 5200.00
    }
  ]
}
```

## Campos Soportados (Bilingüe)

El código mapea campos en inglés y español:

### Campos de Oferta
- `id` / `offer_id` - Identificador único
- `marketer_name` / `comercializadora` / `company_name` - Nombre comercializadora
- `tariff_name` / `nombre_tarifa` / `tarifa` - Nombre de tarifa
- `logo_color` / `color_logo` - Color para UI
- `type` / `tipo` - Tipo (fixed/indexed)
- `power_price` / `precio_potencia` - Precios de potencia
- `energy_price` / `precio_energia` - Precios de energía
- `fixed_fee` / `cuota_fija` - Cuota mensual fija
- `contract_duration` / `duracion_contrato` - Duración del contrato
- `annual_cost` / `costo_anual` - Costo anual de la oferta

### Campos Globales
- `current_annual_cost` / `current_annual_cost_calculated` - Costo anual actual
- `offers` - Array de ofertas (requerido)
- `optimization_result` / `resultado_optimizacion` - Resultado de optimización de potencias (opcional)

## Logs de Depuración

El código imprime logs en la consola del navegador:

```
📤 Sending invoice data to comparison webhook: {...}
📥 Received response from webhook: {...}
✅ Parsed 3 offers from webhook response
```

Si hay errores:
```
❌ Webhook returned error: 500 Internal Server Error
❌ Webhook unavailable, using mock data: Error...
⚠️ Webhook response missing offers array, returning empty
```

## Fallback a Datos Mock

Si el webhook falla, el sistema usa datos mock automáticamente:
- "Energía Plus" - Tarifa Optimizada (15% ahorro)
- "Luz Directa" - Tarifa Verde (8% ahorro)

## Pruebas Manuales

### Curl
```bash
curl -X POST https://sswebhook.iawarrior.com/webhook/effcc85b-5122-4896-9f0c-810e724e12c3 \
  -H "Content-Type: application/json" \
  -d '{
    "period_days": 30,
    "power_p1": 19.0,
    "energy_p2": 746.0,
    "total_amount": 517.61
  }'
```

### Verificación en UI

1. Abrir la aplicación
2. Ir al Simulador de Facturas
3. Subir una factura PDF
4. Revisar que los datos se extraen correctamente (Paso 2)
5. Hacer clic en "Comparativa de Tarifas"
6. Abrir la consola del navegador (F12)
7. Verificar los logs:
   - `📤 Sending invoice data...` - Datos enviados al webhook
   - `📥 Received response...` - Respuesta del webhook
   - `✅ Parsed X offers...` - Ofertas procesadas
8. Verificar que las propuestas se muestran en la UI (Paso 3)

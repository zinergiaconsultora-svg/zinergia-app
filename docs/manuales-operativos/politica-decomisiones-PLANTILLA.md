# Política de Decomisiones — Anexo II del Contrato de Colaboración

> **⚠️ ESTADO: PLANTILLA. NO DISTRIBUIR TODAVÍA.**
> La estructura está completa y validada contra la práctica del sector.
> **Los importes y plazos marcados `[·]` los tiene que rellenar Zinergia a partir de sus contratos con LOGOS, Plenitude, NATURGY y GANA.** Copiar los valores de otra empresa sería un error: son sus condiciones, no las tuyas.

**Versión:** [·] · **En vigor desde:** [·] · **Sustituye a:** —
**Emite:** SINERGIA PRISMA SL *(verificar razón social exacta contra escritura)*

---

## 1 · Qué es una decomisión

Cuando Zinergia da de alta un contrato de suministro, la comercializadora abona una comisión de captación. Si ese contrato **se cae antes de un plazo mínimo** —baja anticipada, impago, anulación, no activación—, la comercializadora **retira total o parcialmente** esa comisión a Zinergia.

Esa retirada se traslada al colaborador que originó la venta. A eso se le llama **decomisión** (o *clawback*).

**No es una penalización ni una sanción.** Es la devolución de un ingreso que finalmente no se produjo. Las penalizaciones por fraude son otra cosa distinta y están en la cláusula 6ª del contrato.

## 2 · Principios

1. **Trazabilidad.** Toda decomisión queda registrada en la app con el contrato afectado, el motivo, la fecha y el importe. Es consultable por el colaborador.
2. **Proporcionalidad.** Salvo que la comercializadora imponga otra cosa, la devolución es proporcional al tiempo que el contrato estuvo activo.
3. **Compensación.** Se descuenta de liquidaciones posteriores. Si no hay saldo suficiente, queda como deuda pendiente compensable con futuras comisiones.
4. **Plazo máximo de reclamación.** Transcurridos **[·] meses** desde la baja, no se reclamará una decomisión no comunicada.
5. **Derecho de alegación.** El colaborador dispone de **[·] días** desde la notificación para aportar pruebas.

## 3 · Cuándo se aplica

| Supuesto | ¿Genera decomisión? |
|---|---|
| Baja voluntaria del cliente antes del plazo mínimo | **Sí**, según la tabla del punto 4 |
| El contrato no llega a activarse en la distribuidora | **Sí, 100 %** |
| Impago del cliente en los primeros [·] meses | **Sí**, según lo que aplique la comercializadora |
| Documentación incompleta o caducada detectada a posteriori | **Sí, 100 %** |
| Venta no consentida / suplantación | **Sí, 100 %** + penalización de la cláusula 6ª |
| Cambio de titular en los primeros [·] días | [· definir: normalmente sí] |
| Baja pasado el plazo mínimo | **No** |
| Baja por causa imputable a la comercializadora (error de facturación, mal servicio acreditado) | **No** — se reclama a la comercializadora |
| Fallecimiento o cese de actividad acreditados | [· definir: recomendable no aplicar] |

## 4 · Tabla de decomisiones por comercializadora

> **Cómo rellenarla:** coge tu contrato con cada comercializadora y busca la cláusula de *clawback* / *decomisión* / *baja anticipada*. Traslada aquí exactamente lo que dice. Si una comercializadora aplica reglas distintas por segmento (residencial / PYME / empresa), añade una fila por segmento.

### Electricidad

| Comercializadora | Segmento | Ventana de decomisión | Regla de devolución | Ancla de cómputo |
|---|---|---|---|---|
| LOGOS | PYME | [· ej. 12 meses] | [· ej. proporcional por meses no consumidos] | [· fecha de activación] |
| LOGOS | Residencial | [·] | [·] | [·] |
| Plenitude | PYME | [·] | [·] | [·] |
| NATURGY | PYME | [·] | [·] | [·] |
| GANA | Residencial | [·] | [·] | [·] |
| GANA | PYME | [·] | [·] | [·] |

### Gas

| Comercializadora | Segmento | Ventana | Regla | Ancla |
|---|---|---|---|---|
| NATURGY | [·] | [·] | [·] | [·] |

### Las cinco formas habituales de calcular la devolución

Elige para cada comercializadora la que figure en su contrato:

| Tipo | Cómo funciona | Ejemplo |
|---|---|---|
| **A · Proporcional por días** | Se devuelve la parte de la ventana no cumplida | Ventana 12 meses, baja a los 4 → se devuelve 8/12 = 66,7 % |
| **B · Proporcional por meses completos** | Igual, contando solo meses enteros | Baja a los 4 meses y 20 días → cuentan 4 meses |
| **C · Escalones por porcentaje** | Tramos fijos | 0-3 meses: 100 % · 4-6: 75 % · 7-9: 50 % · 10-12: 25 % · >12: 0 % |
| **D · Importe fijo** | Cantidad cerrada por contrato caído | [· €] por contrato |
| **E · Por energía no suministrada** | Sobre los kWh que faltaban por consumir | Se devuelve la parte variable proporcional a la energía pendiente |

**Ancla de cómputo** (desde cuándo se cuenta el plazo) — que quede explícito, porque cambia el resultado:
`fecha de activación en la distribuidora` · `fecha de primera factura` · `fecha de firma`

**Recomendación:** usar **fecha de activación**. Es la que la comercializadora usa para pagar, y así ambas fechas coinciden.

## 5 · Cómo se ejecuta

1. La comercializadora comunica la baja o la regularización en su liquidación mensual.
2. Administración concilia esa liquidación contra los contratos registrados en la app.
3. La app genera el **ajuste negativo** sobre el colaborador correspondiente, con motivo y referencia al contrato.
4. El colaborador **recibe la notificación** y puede consultarla en su panel de comisiones.
5. Se descuenta de la siguiente liquidación. Si no hay saldo, queda pendiente.
6. Si el colaborador alega en plazo y tiene razón, se revierte con un ajuste positivo, también registrado.

## 6 · Cómo evitar decomisiones (para el colaborador)

1. **Vende ahorro real, no promesas.** Un cliente que se siente engañado se da de baja el primer mes.
2. **Explica la permanencia** antes de firmar, si la hay.
3. **Documentación correcta a la primera** — factura reciente, DNI vigente, representación acreditada.
4. **Comprueba que el titular es quien firma.** Es el origen más común de anulación.
5. **Avisa de los costes variables** (servicios de ajuste, impuestos) para que la primera factura no sorprenda.
6. **Verifica los datos de contacto y el IBAN** del cliente: un domiciliado que rebota acaba en impago.

## 7 · Consultas

Cualquier duda sobre una decomisión concreta, a través de [· canal] indicando la referencia del contrato.

---

### Anexo · Lo que hace falta para publicar este documento

| # | Dato | De dónde sale |
|---|---|---|
| 1 | Ventana y regla de cada comercializadora | Contratos de Zinergia con LOGOS, Plenitude, NATURGY, GANA |
| 2 | Ancla de cómputo por comercializadora | Los mismos contratos |
| 3 | Plazo máximo de reclamación | Decisión de Zinergia (sugerido: 6 meses) |
| 4 | Plazo de alegación | Decisión de Zinergia (sugerido: 15 días) |
| 5 | Criterio en cambio de titular, fallecimiento y cese | Decisión de Zinergia, revisada por el abogado |
| 6 | Canal de consultas | Decisión de Zinergia |

**Cuando tengas 1 y 2, cargo las reglas como datos en la app** (`commission_decommission_policies` y `commission_decommission_bands`, hoy vacías) **y este documento se genera desde la base de datos** — con lo que nunca podrá desincronizarse de lo que la app aplica de verdad. Ahí es donde le sacas ventaja a la competencia, cuya política es un PDF a mano con un descargo de "puede contener errores".

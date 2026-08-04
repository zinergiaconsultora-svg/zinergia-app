# Auditoría profunda de producción — Zinergia

**Auditor:** Claude (Opus 5) · **Fecha:** 2026-08-04 · **Entorno:** producción (`zinergia.vercel.app`)
**Método:** recorrido de las 24 rutas de la aplicación con sesión de administrador, más consultas de solo lectura sobre la base de datos de producción. Sin datos personales en este informe.

---

## Resumen

La aplicación está **sana**. Las 24 rutas responden 200, sin errores de servidor, sin errores de consola y sin ningún `NaN` en pantalla — contraste directo con el `NaN €` que encontré en el panel de Energilandia.

Pero hay **un error que cuesta dinero** y **un fallo de maquetación en móvil** que conviene arreglar antes de que los use un comercial de verdad.

---

## 🔴 ALTO — 1 · Comercializadora duplicada que rompe el cálculo de comisión

**El hallazgo más importante de esta auditoría.**

El catálogo tiene **cinco** cadenas de compañía; las reglas de comisión sólo cubren **cuatro**:

| Catálogo de tarifas | Reglas de comisión |
|---|---|
| `GANA ENERGIA` (2 tarifas) | ❌ **ninguna** |
| `GANA_ENERGIA` (3 tarifas) | ✅ |
| `LOGOS` (19) | ✅ |
| `NATURGY` (17) | ✅ |
| `Plenitude` (24) | ✅ |

Es la **misma comercializadora escrita de dos formas**: una con espacio, otra con guion bajo. Y como `tariff_commissions` se casa por la cadena `company`, la variante con espacio no encuentra ninguna regla.

**Las dos tarifas afectadas están activas y son vendibles:**

- `GANA ENERGIA :: Fijo 24h` — 2.0TD, PYME
- `GANA ENERGIA :: Tarifa tramos horarios` — 2.0TD, PYME

**Qué pasa en la práctica:** un comercial compara, propone y cierra una de esas dos tarifas, y su comisión no se calcula. En el comparador aparece como **"Pendiente"**, que se lee como *"se calculará luego"* y no como *"esta tarifa no tiene comisión configurada"*. En la presentación al cliente, la línea de comisión sencillamente desaparece.

**Arreglo:** unificar la cadena a `GANA_ENERGIA` en las 2 tarifas huérfanas — o al revés, según cuál sea la canónica. Es un `UPDATE` de dos filas.

**Y la mejora de fondo:** que `company` sea una cadena libre es la causa. Mientras lo sea, esto volverá a pasar. Merece una tabla de comercializadoras con clave propia, o como mínimo una restricción sobre el conjunto de valores permitidos.

---

## 🔴 ALTO — 2 · Maquetación rota en móvil en Gestión de Tarifas

A 375 px, `/dashboard/tariffs` desborda **125 px en horizontal**.

Los elementos que se desbordan son la **cabecera fija** y la **navegación inferior fija**, ambas con `inset-x-0`: la tabla ancha estira el documento a 500 px y los elementos fijos se estiran con él, en lugar de quedarse en el ancho de la pantalla.

Efecto para el usuario: al desplazarse en horizontal para ver la tabla, **la cabecera y la barra de navegación se descuadran**.

Es un fallo clásico y la solución es conocida: la tabla debe desplazarse **dentro de su propio contenedor** con `overflow-x: auto`, y el documento no debe desbordar nunca.

> Contexto: el resto de la aplicación pasa la prueba de móvil sin una sola incidencia. Esta página es la excepción.

---

## 🟠 MEDIO — 3 · La página de tarifas pesa 609 KB de HTML

12 veces la media del resto de páginas (~50 KB), con **5.905 nodos de DOM** y **sin paginación**: las 62 tarifas se renderizan de una vez.

Con 65 tarifas es lento; el problema es que **no escala**. Energilandia tiene 38.448 productos. Si el catálogo crece un orden de magnitud, esta página deja de abrirse en un móvil.

**Mejora:** paginar o virtualizar, y no mandar al cliente las 352 reglas de comisión que probablemente van embebidas.

---

## 🟠 MEDIO — 4 · Ninguna tarifa tiene configurada la compensación de excedentes

**64 de 64 tarifas activas** tienen `surplus_compensation_price = 0`.

La funcionalidad de autoconsumo existe en el esquema y en el motor de cálculo, pero **el catálogo entero está sin configurar**. Cualquier cliente con placas solares recibe una comparativa que ignora por completo sus excedentes.

Atenuante: el simulador emite la alerta `missing_surplus_compensation_price` cuando la factura tiene excedentes. Avisa, pero no calcula.

Y es un hueco comercial real: el autoconsumo con batería virtual es de lo más demandado ahora mismo, y Energilandia lo tiene documentado comercializadora por comercializadora.

---

## 🟠 MEDIO — 5 · Tres tarifas de gas activas, sin precio y fuera del comparador

Existen 3 tarifas de gas —`NATURGY :: Tarifa Por Uso Gas` en RL.1, RL.2 y RL.3—, **activas**, pero:

- `energy_price_p1 = 0` y `power_price_p1 = 0` (el gas usa otros campos de precio)
- el comparador filtra por `supply_type = 'electricity'`, así que **nunca aparecen**

Son entradas de catálogo que no se pueden usar. O se completan y se integran, o se desactivan para que no confundan.

> **Corrección a mi informe anterior:** dije que el gas era "cero" en zinergia. **Me equivoqué**: hay 3 tarifas de gas de una comercializadora. Siguen siendo inservibles hoy, pero el dato correcto es 3, no 0.

---

## 🟡 BAJO — 6 · "Pendiente" es un aviso demasiado suave

Cuando una tarifa no tiene comisión, el comparador muestra **"Pendiente"**. Es correcto que no invente un cero, pero la palabra sugiere *pendiente de cálculo*, no *sin configurar*. Con dinero de por medio, merece un aviso explícito.

## 🟡 BAJO — 7 · Detalles de accesibilidad

- **13 elementos interactivos por debajo de 32 px** en móvil. La recomendación WCAG es 44 px. Tus comerciales trabajan desde el teléfono. Los 12 principales son el botón **"Analizar"** de la cola de conversión —la acción primaria de esa pantalla— a 28 px de alto.

> **Retractación.** En la primera versión de este informe afirmé que `/admin` tenía **dos elementos `h1`**. **Es falso.** Al verificarlo específicamente, el HTML del servidor y el DOM hidratado tienen **uno solo**, tanto a 1280 px como a 375 px. La lectura original fue un error de medición mío.

## 🟡 BAJO — 8 · Escala del catálogo

65 tarifas y 5 comercializadoras, frente a las ~37 comercializadoras de Energilandia. No es un defecto del software —es una realidad de negocio— pero es **el foso competitivo real**, y ninguna mejora técnica lo compensa.

---

## Lo que está bien, y conviene decirlo

| Verificación | Resultado |
|---|---|
| 24 rutas, respuesta HTTP | ✅ todas 200 |
| Errores de consola | ✅ ninguno |
| `NaN` en pantalla | ✅ ninguno |
| Desbordamiento horizontal en móvil (23 de 24 rutas) | ✅ ninguno |
| Elementos interactivos sin etiquetar | ✅ **0** |
| Imágenes sin `alt` | ✅ 0 |
| TTFB | ✅ 48 ms |
| Reglas de comisión con valor cero | ✅ 0 de 352 |

Comparado con Energilandia —13 botones sin etiqueta, sin encabezados semánticos, `NaN` en producción— **la calidad de front-end de zinergia está en otra liga**.

---

## Corrección importante sobre el modelo de comisiones

En mi análisis competitivo escribí que Energilandia tenía una **matriz de comisión por tramos** y que zinergia tenía un "% plano por franquicia". **Eso era incorrecto**, y quiero dejarlo claro porque afecta a la conclusión estratégica.

`tariff_commissions` es exactamente una matriz por tramos:

```
company × supply_type × tipo_cliente × modelo × producto_tipo × servicio
         × [consumption_min_mwh, consumption_max_mwh]
         → commission_fixed_eur + commission_variable_mwh
```

**352 reglas activas** sobre 4 comercializadoras, con parte fija y parte variable por MWh. Es el mismo modelo que Energilandia, e incluso más expresivo al separar fijo de variable.

La diferencia entre ambos **no es de modelo, es de volumen de datos mantenidos**.

---

## Prioridad recomendada

| # | Acción | Esfuerzo |
|---|---|---|
| 1 | Unificar `GANA ENERGIA` → `GANA_ENERGIA` en 2 tarifas | minutos |
| 2 | Restricción o tabla propia para `company` | horas |
| 3 | Contener la tabla de tarifas en su propio scroll horizontal | horas |
| 4 | Paginar o virtualizar el catálogo | 1 día |
| 5 | Poblar `ssa_treatment` y `surplus_compensation_price` | días, es trabajo de datos |
| 6 | Decidir sobre las 3 tarifas de gas: completar o desactivar | minutos |
| 7 | Endurecer el aviso de comisión ausente | horas |
| 8 | Tamaños de pulsación en móvil | horas |

Las dos primeras son las que tocan dinero. Yo empezaría por ahí.

---

## Estado de resolución — 2026-08-04

| # | Hallazgo | Estado |
|---|---|---|
| 1 | Tarifas vendibles sin comisión | ✅ **Resuelto** — las 2 desactivadas; `active_without_commission_rules` devuelve vacío. Reactivación en `supabase/scripts/ROLLBACK_reactivate_gana_pyme_20260804.sql`, condicionada a que existan las reglas PYME de GANA |
| 2 | Desbordamiento móvil en Tarifas | ✅ **Resuelto** — era la barra de pestañas (`w-fit`), no la tabla. Medido: documento de 500 px → 375 px |
| 6 | "Pendiente" demasiado suave | ✅ **Resuelto** — ahora dice **"Sin configurar"** en ámbar, con explicación al pasar el ratón |
| 7 | Tamaños de pulsación | ✅ **Parcial** — el botón "Analizar" pasa a 44 px |
| — | Pipeline de despliegue roto desde el 2-ago | ✅ **Resuelto** — build remoto en lugar de `--prebuilt --archive=tgz` |
| 3 | 609 KB en la página de tarifas | ⏸️ **No resuelto a propósito** — ver abajo |
| 4 | Compensación de excedentes sin configurar | ❌ **Bloqueado** — dato de negocio |
| 5 | 3 tarifas de gas sin precio | ⏸️ **No resuelto a propósito** — ver abajo |

### Por qué no toqué el peso de la página de tarifas

Con 65 tarifas es lento, pero **no es un defecto actual: es un límite de escala**. Paginar o virtualizar es un cambio grande en una pantalla de edición con formularios en línea, y no tengo forma de verificarlo visualmente (las previews de Vercel están tras autenticación). Hacer una refactorización así sin verificación, horas después de una demo, es peor negocio que dejarlo documentado.

Se vuelve urgente cuando el catálogo crezca de 65 a varios cientos.

### Por qué no desactivé las 3 tarifas de gas

Son de NATURGY, y **NATURGY sí tiene una regla de comisión de gas** configurada. Eso indica que alguien empezó a construir el vertical de gas deliberadamente. Desactivarlas borraría esa intención sin preguntar.

Además son inofensivas hoy: el comparador filtra por `supply_type = 'electricity'`, así que **no aparecen en ninguna comparativa**. Están inertes, no rotas.

Es una decisión de producto: completarlas o retirarlas. No mía.

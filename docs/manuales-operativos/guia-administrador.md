# Guía del Administrador — App Zinergia

**Para:** el técnico responsable de altas, revisión de facturas y propuestas.
**Versión:** 2026-08-05 · basada en la aplicación en producción (`zinergia.vercel.app`).
**Capturas:** los puntos marcados `[CAPTURA n]` tienen al final una lista con la ruta exacta y qué encuadrar. Se insertan en 15 minutos con Win+Mayús+S.

---

## 1 · Acceso y qué significa ser administrador

Entra en **zinergia.vercel.app** con la cuenta de administrador. La navegación inferior tiene 5 zonas: **Hoy · Clientes · Comisiones · Equipo · Más**.

El administrador ve toda la red, valida operaciones y es el único que puede cambiar roles y franquicias.

> ⚠️ **Regla que no se puede romper:** la cuenta de administrador **nunca debe tener franquicia ni responsable asignados**. Si alguien se los asigna, el sistema deja de reconocerla como administrador y no podrá gestionar la red (y ya no es recuperable desde la propia app). En "Equipo y red" el admin debe aparecer siempre con franquicia *"Sin asignar"*. `[CAPTURA 1]`

## 2 · El día a día: el panel "Hoy"

Al entrar, el panel **Hoy** lista las operaciones que necesitan revisión, en **dos colas**: `[CAPTURA 2]`

**1 · Preparar propuestas** — *"Facturas analizadas que todavía no tienen una propuesta."*
Arriba, dos cifras: cuántas hay **pendientes** y la **facturación/año** que suman. Cada tarjeta muestra el cliente, el peaje detectado (2.0TD…), **los días que lleva sin procesar** en ámbar, el colaborador que la subió, el CUPS, el coste anual, y el botón **Analizar**, que abre el comparador con esos datos.

**2 · Tramitar altas** — *"Propuestas aceptadas pendientes de cambio de comercializadora."*
Cuando no hay nada, muestra *"Sin expedientes pendientes"*.

**Rutina diaria recomendada:** vaciar ambas colas. Una factura subida por un colaborador no debería pasar de 24-48 h sin propuesta. El contador de días en ámbar es justamente para que salte a la vista cuando eso deja de cumplirse.

## 3 · Alta de un colaborador (de la invitación al primer acceso)

1. **Equipo** (`/admin/agents`) → pestaña **"Estructura comercial"** → botón **"Invitar a la Red"**, arriba a la derecha. `[CAPTURA 3]`
2. Rellena el email del colaborador y envía. La invitación caduca si no se usa.
3. El colaborador recibe el enlace, se registra y **queda pendiente hasta que el sistema confirma el alta** (el aprovisionamiento se reconcilia solo; si un alta se queda atascada más de 15 minutos, queda registrada para revisión).
4. Cuando aparezca en la red, comprueba en **Equipo y red → Personas** (`/admin/agents`) que tiene el rol correcto.

### Cambiar el rol o la franquicia de alguien

En **Equipo → pestaña "Personas"** (`/admin/agents`), cada persona tiene dos iconos a la derecha: **lápiz** (editar nombre) y **llave** (cambiar autoridad). Arriba hay buscador por nombre o email y filtros por rol y franquicia. `[CAPTURA 4]`

> **Sobre el vocabulario:** en esta tabla el rol sale escrito **"AGENTE"**, pero en el organigrama, en el diálogo de autoridad y en el resto de la aplicación la misma persona es **"Colaborador"**. Son lo mismo.

El diálogo **"Cambiar autoridad"** muestra el estado ACTUAL y la PROPUESTA, y exige cuatro cosas: `[CAPTURA 5]`

| Campo | Qué poner |
|---|---|
| Rol propuesto | Colaborador · Franquicia · Administrador · Pendiente/desactivado |
| Franquicia | A cuál pertenece (obligatorio para colaborador y franquicia) |
| Responsable | De quién cuelga |
| **Motivo** | Obligatorio: cambio de rol, asignación/retirada de franquicia, desactivación, reactivación, corrección |

**Todo cambio queda registrado de forma inmutable** (quién, cuándo, qué y por qué). Si al confirmar da error de "versión obsoleta", alguien tocó a esa persona a la vez: recarga y repite.

> Los recuadros ACTUAL y PROPUESTA muestran hoy el responsable y la franquicia **como identificadores largos** (`8ec36524-22b8-…`) en vez de por su nombre. Fíate de los desplegables de abajo, que sí van con nombres.

## 4 · Revisión de facturas (OCR)

**Tu cola de trabajo es "Hoy", no esta pantalla.** Desde **Hoy → Analizar** se abre la factura con los datos extraídos para **confirmarlos o corregirlos** antes de generar la comparativa. Revisa siempre: titular, CUPS, periodo (días), consumos por periodo y potencias.

**`/admin/ocr` — "Observabilidad OCR"** es otra cosa: mide la **salud del sistema**, no las facturas concretas. De hecho avisa de que funciona *"sin mostrar datos extraídos de facturas"*. Verás: trabajos de las últimas 24 h, % de fallos a 30 días, cuántos hay atascados, agentes con reintentos, y el desglose por ventanas de 24 h / 7 días / 30 días. `[CAPTURA 6]`

Míralo cuando **sospeches que algo va mal** —facturas que no aparecen, colaboradores que se quejan de que no se procesa—, no como rutina diaria. Todo a cero con facturas pendientes antiguas significa que nadie está subiendo nada nuevo, no que haya un fallo.

**Criterio de calidad** (alineado con el contrato de colaboración): factura de **menos de 3 meses**, titular legible y CUPS completo. Si no se cumple, pídesela de nuevo al colaborador en vez de tramitarla.

> ⚠️ **Este criterio hoy lo aplicas tú, no la aplicación.** El sistema no comprueba la fecha de la factura: la lectura automática no guarda un campo de fecha con el que validarla. Hasta que se construya esa comprobación, revisarlo es parte de tu trabajo.

## 5 · Propuestas

- **`/dashboard/proposals`** — todas las propuestas de la red, con su estado.
- Cada propuesta genera un **enlace público** para el cliente (página `/p/…`): el cliente la ve y la acepta desde ahí, y la aceptación queda registrada con su evidencia.
- Antes de validar una propuesta, mira las **alertas** del comparador (esquina de cada oferta): faltan datos, energía reactiva, servicios de ajuste sin configurar…

> **Comisión "Sin configurar"** (en ámbar): esa tarifa no tiene regla de comisión — el colaborador no cobraría nada por cerrarla. No valides propuestas con esa marca; configura antes la comisión (sección 6).

## 6 · Tarifas y comisiones (el catálogo)

**`/dashboard/tariffs`** — *"Gestión de Tarifas · Panel administrador — edición completa"*. Tres pestañas con su recuento: **Electricidad (62) · Gas (3) · Comisiones (352)**, y arriba a la derecha el total: *65 tarifas · 352 reglas*. Debajo, filtros rápidos por compañía. `[CAPTURA 7]`

Cada tarifa lleva una etiqueta de estado de comisión: **"COMISIÓN OK"** en verde, o **"SIN COMISIÓN"** en ámbar con un triángulo de aviso. Las que están en ámbar aparecen atenuadas porque están desactivadas.

- **Crear/editar tarifa**: botón "Nueva tarifa" o lápiz en la fila. Campos clave: compañía, nombre, tipo (fijo/indexado), ATR (2.0TD…), precios por periodo P1-P6, cuota fija, **precio de compensación de excedentes** (autoconsumo) y **tratamiento de servicios de ajuste**.
- **Importar Excel**: botón "Excel" para cargar tarifas en bloque.
- **Comisiones**: reglas por compañía × tipo de cliente × banda de consumo, con parte fija (€) y variable (€/MWh). Es lo que alimenta la comisión estimada del comparador.

> ⚠️ **Tres cosas pendientes de datos** (agosto 2026):
> 1. Las 2 tarifas **GANA PYME están desactivadas a propósito** porque no tienen comisión configurada. Cuando lleguen los importes, se crean las reglas y se reactivan.
> 2. **Servicios de ajuste**: ninguna tarifa tiene aún el tratamiento configurado (incluido / facturado aparte / con techo). Hasta entonces el comparador avisa con "tratamiento no configurado".
> 3. **Excedentes de autoconsumo**: precio a 0 en todo el catálogo; los clientes con placas ven la comparativa sin compensación.

## 7 · Control económico

**`/admin/commissions`** — *"Control económico · Comisiones"*. Tres pestañas: **Operaciones · Modelo económico · Fiscal**. Dentro de Operaciones, bajo el título *"Trabajo pendiente — cada cola tiene una única decisión operativa"*, están las tres colas con su contador: `[CAPTURA 8]`

```
VALIDAR  →  LIQUIDAR  →  AJUSTES Y CONCILIACIÓN
```

- **Validar**: operaciones cerradas pendientes de dar por buenas.
- **Liquidar**: comisiones validadas pendientes de pago. La app emite **autofactura** en nombre del colaborador (él debe tener sus datos fiscales completos y el acuerdo de autofacturación aceptado — lo hace desde su perfil).
- **Ajustes**: discrepancias documentadas (un colaborador reclama una comisión, una comercializadora paga distinto de lo esperado…).

## 8 · Equipo y estructura

Todo vive en **Equipo** (`/admin/agents`), en dos pestañas:

- **Personas** — todas las personas con rol y franquicia, con buscador y filtros.
- **Estructura comercial** — *"Mi Red"*: cuatro indicadores (colaboradores activos, franquicias activas, volumen total de red y royalty estimado), el botón **Invitar a la Red**, y debajo el **organigrama** con la cartera y el volumen de cada persona. Tiene además tres vistas: Estructura · Mapa · Inteligencia. `[CAPTURA 9]`
- Traspaso de clientes entre colaboradores: es una operación gobernada — el colaborador puede **solicitarlo**, y lo apruebas tú o la franquicia. Todo traspaso queda registrado con motivo.

## 9 · Otras zonas del admin

| Ruta | Qué es |
|---|---|
| `/admin/leads` | Gestión de leads y su embudo |
| `/admin/audit` | Registro de auditoría de acciones |
| `/admin/rgpd` | Herramientas RGPD (derechos de los interesados) |
| `/admin/drive` | Sincronización documental con Google Drive |
| `/admin/business-metrics` y `/admin/reporting` | Métricas e informes |
| `/admin/academy` | Contenidos de formación |

## 10 · Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| "Recarga y vuelve a intentarlo" al cambiar autoridad | Otro admin tocó a la misma persona a la vez. Recarga la página y repite |
| Comisión "Sin configurar" en el comparador | Falta la regla de comisión de esa compañía/segmento → pestaña Comisiones |
| Un colaborador invitado no aparece | El alta se reconcilia sola en minutos; si pasa de 15 min, revisar con soporte técnico |
| La comparativa avisa de "servicios de ajuste" | Normal hasta que se configure el catálogo (sección 6) |
| Un admin aparece con franquicia asignada | **No debe pasar.** No lo guardes; si ya pasó, avisar a soporte técnico antes de tocar nada |

---

## Lista de capturas para insertar

Rutas verificadas contra la aplicación en producción el 05/08/2026.

| # | Ruta | Qué encuadrar |
|---|---|---|
| 1 | `/admin/agents` → Personas | La fila de **Admin Zinergia** con el rol ADMIN y la franquicia *"Sin asignar"* |
| 2 | `/admin` | El panel Hoy entero: las dos colas, con los contadores de "Preparar propuestas" arriba |
| 3 | `/admin/agents` → Estructura comercial | Los cuatro indicadores y el botón **"Invitar a la Red"** |
| 4 | `/admin/agents` → Personas | Una fila de colaborador con los iconos lápiz y llave a la derecha |
| 5 | `/admin/agents` → icono llave | El diálogo **"Cambiar autoridad"** completo: ACTUAL / PROPUESTA / Rol / Franquicia / Responsable / Motivo |
| 6 | `/admin/ocr` | Los cuatro indicadores de cabecera de **Observabilidad OCR** |
| 7 | `/dashboard/tariffs` | Las tres pestañas con sus recuentos y varias filas, **incluyendo una con la etiqueta ámbar "SIN COMISIÓN"** |
| 8 | `/admin/commissions` | "Trabajo pendiente" con las tres colas y sus contadores |
| 9 | `/admin/agents` → Estructura comercial, abajo | El organigrama: el admin arriba y los colaboradores colgando, con cartera y volumen |

> ⚠️ **Antes de guardar cada imagen, tapa los datos personales.** Estas pantallas muestran nombres reales de clientes, CUPS y correos de colaboradores. Difumina o recorta lo que sea identificable: la guía va a circular entre personas que no tienen por qué ver la cartera.

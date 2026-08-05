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

Al entrar, el panel **Hoy** lista las operaciones que necesitan revisión: `[CAPTURA 2]`

- **Preparar propuestas** — facturas ya analizadas por la IA que aún no tienen propuesta. Cada tarjeta muestra el cliente, la tarifa detectada, los días sin procesar y el botón **Analizar**, que abre el comparador con los datos de esa factura.

**Rutina diaria recomendada:** vaciar esta cola. Una factura subida por un colaborador no debería pasar de 24-48 h sin propuesta.

## 3 · Alta de un colaborador (de la invitación al primer acceso)

1. **Equipo → Mi Red** (`/dashboard/network`) → botón **"Invitar a la Red"**. `[CAPTURA 3]`
2. Rellena el email del colaborador y envía. La invitación caduca si no se usa.
3. El colaborador recibe el enlace, se registra y **queda pendiente hasta que el sistema confirma el alta** (el aprovisionamiento se reconcilia solo; si un alta se queda atascada más de 15 minutos, queda registrada para revisión).
4. Cuando aparezca en la red, comprueba en **Equipo y red → Personas** (`/admin/agents`) que tiene el rol correcto.

### Cambiar el rol o la franquicia de alguien

En `/admin/agents`, cada persona tiene dos iconos: **lápiz** (editar nombre) y **llave** (cambiar autoridad). `[CAPTURA 4]`

El diálogo **"Cambiar autoridad"** muestra el estado ACTUAL y la PROPUESTA, y exige cuatro cosas: `[CAPTURA 5]`

| Campo | Qué poner |
|---|---|
| Rol propuesto | Colaborador · Franquicia · Administrador · Pendiente/desactivado |
| Franquicia | A cuál pertenece (obligatorio para colaborador y franquicia) |
| Responsable | De quién cuelga |
| **Motivo** | Obligatorio: cambio de rol, asignación/retirada de franquicia, desactivación, reactivación, corrección |

**Todo cambio queda registrado de forma inmutable** (quién, cuándo, qué y por qué). Si al confirmar da error de "versión obsoleta", alguien tocó a esa persona a la vez: recarga y repite.

## 4 · Revisión de facturas (OCR)

- **`/admin/ocr`** — panel de trabajos de OCR: estado de cada factura subida, errores y precisión del motor. `[CAPTURA 6]`
- Desde **Hoy → Analizar** se abre la factura con los datos extraídos para **confirmarlos o corregirlos** antes de generar la comparativa. Revisa siempre: titular, CUPS, periodo (días), consumos por periodo y potencias.

**Criterio de calidad** (alineado con el contrato de colaboración): factura de menos de 2 meses, titular legible y CUPS completo. Si no se cumple, pídesela de nuevo al colaborador en vez de tramitarla.

## 5 · Propuestas

- **`/dashboard/proposals`** — todas las propuestas de la red, con su estado.
- Cada propuesta genera un **enlace público** para el cliente (página `/p/…`): el cliente la ve y la acepta desde ahí, y la aceptación queda registrada con su evidencia.
- Antes de validar una propuesta, mira las **alertas** del comparador (esquina de cada oferta): faltan datos, energía reactiva, servicios de ajuste sin configurar…

> **Comisión "Sin configurar"** (en ámbar): esa tarifa no tiene regla de comisión — el colaborador no cobraría nada por cerrarla. No valides propuestas con esa marca; configura antes la comisión (sección 6).

## 6 · Tarifas y comisiones (el catálogo)

**`/dashboard/tariffs`** — tres pestañas: **Electricidad · Gas · Comisiones**. `[CAPTURA 7]`

- **Crear/editar tarifa**: botón "Nueva tarifa" o lápiz en la fila. Campos clave: compañía, nombre, tipo (fijo/indexado), ATR (2.0TD…), precios por periodo P1-P6, cuota fija, **precio de compensación de excedentes** (autoconsumo) y **tratamiento de servicios de ajuste**.
- **Importar Excel**: botón "Excel" para cargar tarifas en bloque.
- **Comisiones**: reglas por compañía × tipo de cliente × banda de consumo, con parte fija (€) y variable (€/MWh). Es lo que alimenta la comisión estimada del comparador.

> ⚠️ **Tres cosas pendientes de datos** (agosto 2026):
> 1. Las 2 tarifas **GANA PYME están desactivadas a propósito** porque no tienen comisión configurada. Cuando lleguen los importes, se crean las reglas y se reactivan.
> 2. **Servicios de ajuste**: ninguna tarifa tiene aún el tratamiento configurado (incluido / facturado aparte / con techo). Hasta entonces el comparador avisa con "tratamiento no configurado".
> 3. **Excedentes de autoconsumo**: precio a 0 en todo el catálogo; los clientes con placas ven la comparativa sin compensación.

## 7 · Control económico

**`/admin/commissions`** — tres pestañas: **Operaciones · Modelo económico · Fiscal**, con tres colas: `[CAPTURA 8]`

```
VALIDAR  →  LIQUIDAR  →  AJUSTES Y CONCILIACIÓN
```

- **Validar**: operaciones cerradas pendientes de dar por buenas.
- **Liquidar**: comisiones validadas pendientes de pago. La app emite **autofactura** en nombre del colaborador (él debe tener sus datos fiscales completos y el acuerdo de autofacturación aceptado — lo hace desde su perfil).
- **Ajustes**: discrepancias documentadas (un colaborador reclama una comisión, una comercializadora paga distinto de lo esperado…).

## 8 · Equipo y estructura

- **`/admin/agents`** — todas las personas con rol y franquicia, con filtros.
- **`/dashboard/network`** — organigrama visual de la red con cartera y volumen por persona. `[CAPTURA 9]`
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

| # | Ruta | Qué encuadrar |
|---|---|---|
| 1 | `/admin/agents` | La fila del admin con franquicia "Sin asignar" |
| 2 | `/admin` | El panel Hoy con la cola "Preparar propuestas" |
| 3 | `/dashboard/network` | El botón "Invitar a la Red" arriba a la derecha |
| 4 | `/admin/agents` | Una fila de colaborador con los iconos lápiz y llave |
| 5 | `/admin/agents` → llave | El diálogo "Cambiar autoridad" completo (ACTUAL/PROPUESTA/Motivo) |
| 6 | `/admin/ocr` | El panel de trabajos OCR |
| 7 | `/dashboard/tariffs` | Las tres pestañas con la tabla de electricidad |
| 8 | `/admin/commissions` | Las colas Validar/Liquidar/Ajustes |
| 9 | `/dashboard/network` | El organigrama con los colaboradores |

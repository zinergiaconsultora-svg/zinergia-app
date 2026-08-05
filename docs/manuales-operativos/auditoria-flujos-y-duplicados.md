# Flujos rotos, duplicados y código muerto

**Fecha:** 2026-08-05 · continuación de la [auditoría del perfil de colaborador](./auditoria-perfil-colaborador.md).
**Cómo:** siguiendo cada pantalla del colaborador hasta la tabla de base de datos que hay detrás, y comprobando contra la base real de staging.

---

## 1 · En Ajustes, solo funciona una pestaña de cuatro

Un colaborador ve cuatro pestañas: **Perfil · Operativa · Datos Fiscales · Red**. El estado real:

| Pestaña | Estado |
|---|---|
| **Datos Fiscales** | ✅ Funciona. Es la única |
| **Red** | ❌ No pintaba nada ahí — **ya está quitada** (hoy) |
| **Perfil** | ❌ El botón Guardar **no ha funcionado nunca** |
| **Operativa** | ❌ Ídem, y parte del formulario ni siquiera está conectado |

### Por qué Perfil y Operativa no guardan

El formulario intenta escribir en la tabla `franchise_config` cinco columnas **que no existen** — comprobado contra la base de datos real:

```
✗ NO existe  franchise_config.owner_id
✗ NO existe  franchise_config.nif
✗ NO existe  franchise_config.address
✗ NO existe  franchise_config.default_margin
✗ NO existe  franchise_config.default_vat
```

Cada vez que alguien pulsa Guardar en esas pestañas, sale **"Error al guardar"**. Siempre. Y la carga falla en silencio, así que los campos aparecen vacíos o con valores de fábrica, se guarde lo que se guarde.

Además, el cuadro de "Textos Legales y RGPD" de Operativa **no está conectado a nada**: lo que se escribe ahí se descarta antes incluso de intentar guardarlo.

**Qué significa:** esas dos pestañas son un resto de una versión anterior del producto (un comparador genérico donde cada usuario era una empresa que ponía su margen, su IVA y su cláusula legal). En el modelo actual —los contratos son de Zinergia, no del comercial— **no tienen sentido para un colaborador ni funcionando**.

**Que nadie se haya quejado nunca de un botón que siempre falla dice lo mismo: nadie las usa.**

**Recomendación:** dejar al colaborador **Perfil básico (nombre y teléfono, que sí funciona por otra vía) y Datos Fiscales**. Quitar Operativa entera; el margen, el IVA y los textos legales, si algún día hacen falta, son configuración de empresa, no de cada comercial. Es decisión de producto: no lo he tocado.

---

## 2 · Hay dos sistemas anti-duplicados, y ninguno funcionó

Los doce duplicados de la misma factura no entraron por falta de control. Entraron porque **hay dos controles distintos y cada uno tiene su agujero**:

**El de la subida por lotes** compara la huella del fichero (si subes el mismo PDF dos veces, lo pilla). Pero empieza así:

```
si el perfil no tiene franquicia → no es duplicado
```

¿Quién no tiene franquicia? **El administrador** — por diseño, es el invariante que blindamos. O sea: el control de duplicados **se apaga solo justo para el perfil que hace las pruebas**.

**El de la subida normal** compara CUPS + mes de la factura. Dos agujeros: **solo avisa, no bloquea** (el aviso se puede ignorar doce veces), y se salta la comprobación si el CUPS tiene menos de 18 caracteres — **justo el caso del `****97RY`** que provocó los duplicados.

**Recomendación:** una sola comprobación (huella del fichero + CUPS/mes como refuerzo), en el servidor, para todos los perfiles, y que **bloquee con opción consciente de continuar** — como hace el verificador documental de la competencia.

### Una corrección a algo que dije ayer

Escribí que la validación de "factura de menos de 3 meses" no podía construirse porque el OCR no guarda la fecha de la factura. **Es menos grave de lo que dije:** la fecha **sí se extrae** (viene en los datos leídos y el control de duplicados ya la usa para sacar el mes). No hay una columna propia, pero el dato existe. La validación de 3 meses es más barata de construir de lo que documenté.

---

## 3 · Código muerto: seis piezas que nadie usa

Componentes exportados que **ningún fichero importa**:

| Pieza | Qué es |
|---|---|
| `settings/SettingsProfileTab.tsx` | Copia de la pestaña Perfil, de un refactor que se quedó a medias |
| `settings/SettingsCommercialTab.tsx` | Copia de Operativa, ídem |
| `settings/SettingsNetworkTab.tsx` | Copia de Red, ídem |
| `DashboardView.tsx` | Un panel de inicio antiguo, sustituido por la cola de trabajo |
| `AgendaToday.tsx` | Una agenda del día que no se monta en ninguna pantalla |
| Ruta `/dashboard/analytics` | Página accesible por URL pero **sin ningún enlace vivo** que lleve a ella: el único que la enlazaba es DashboardView, que está muerto |

**El riesgo de esto no es el peso:** es que el próximo cambio se haga en la copia muerta en vez de en la viva — nos pasó de refilón esta semana con las dos pestañas de comisiones, una protegida y la otra no.

**Recomendación:** borrarlos. Están en git si algún día hacen falta.

---

## 3 bis · La tabla de la red llamaba "Colaborador" al administrador · MEDIA

En la pestaña "Red", la columna **Tipo** hacía **una sola pregunta**: *¿es franquicia?* Todo lo que no lo fuera se etiquetaba **Colaborador** — incluida la cuenta de administración, que aparecía listada como un colaborador más.

Los roles son **tres**, no dos. Y precisamente el administrador es el que no debe confundirse con un colaborador: su autoridad se sostiene sobre no tener franquicia ni responsable, que es el invariante que blindamos en agosto. Una pantalla que lo presenta como colaborador contradice por escrito lo que el sistema garantiza por dentro.

**Arreglado**, con test que comprueba las tres etiquetas a la vez.

> En esa misma fila hay un **"Canon Entrada: 3.000 €" escrito a mano en el código**, no leído de ningún sitio. Mismo patrón que los repartos 100/80/50 de las tarjetas de arriba: cifras que parecen datos y no lo son. No lo he tocado, pero conviene saberlo antes de tomar una decisión mirando esa pantalla.

## 4 · Lo arreglado

**Pestaña "Red" fuera del perfil de colaborador.** Mismo permiso que su pestaña hermana de Comisiones. Quien configura comisiones la sigue viendo. Con test que lo fija en las dos direcciones.

**Control de duplicados unificado.** Los dos controles comparten ahora una sola pieza (`src/lib/ocr/invoiceIdentity.ts`) que decide qué es la misma factura y contra qué facturas comparar:

- **El agujero del administrador, cerrado.** Quien no tiene franquicia ya no se da por bueno sin comprobar nada: se busca entre sus propias facturas. Hay test, y comprobé que **falla si se reintroduce el fallo**.
- **Una sola forma de leer la fecha.** Había dos copias de las mismas expresiones regulares; ahora hay una. Dos copias de una regla acaban divergiendo.
- **Los clientes se buscan por su columna correcta** (`owner_id` cuando no hay franquicia), que es donde el arreglo anterior se habría quedado corto sin encontrar nada.

**Lo que queda de este punto:** que el aviso de duplicado **bloquee** en vez de solo avisar. Hoy es una alerta más en una lista, y se puede ignorar tantas veces como haga falta — que es literalmente lo que pasó doce veces. Es un cambio en el flujo de venta y prefiero que lo veas antes de tocarlo.

## Orden sugerido para lo demás

1. **Que el duplicado bloquee** con opción consciente de continuar — la otra mitad del punto 2
2. **Quitar Perfil/Operativa rotas** del colaborador (punto 1) — decisión de producto, dos horas
3. **Borrar el código muerto** (punto 3) — media hora, y evita el próximo susto
4. La validación de 3 meses, ahora que se sabe que la fecha ya viene extraída

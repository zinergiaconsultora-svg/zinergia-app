# Auditoría del perfil de colaborador

**Fecha:** 2026-08-05
**Cómo:** recorriendo la aplicación en producción con una cuenta de colaborador, y contrastando cada hallazgo contra el código.

---

## 1 · Un colaborador ve el modelo de comisiones de la empresa · ALTA

**Dónde:** Ajustes → pestaña **"Red"**.

Un colaborador cualquiera abre esa pestaña y ve *"Configuración de Comisiones — define cuánto gana cada tipo de socio por captación"*, con el reparto entero:

- **Venta directa (tú):** 100 %
- **Venta franquicia:** 80 % ellos, 20 % tú
- **Venta colaborador:** 50 %

Más los rápeles por volumen (niveles Bronce y Oro, *"+20 ventas → +5 % extra"*) y un botón **"Nueva Entidad"**.

**Por qué importa:** eso le dice a un comercial que de cada captación suya la empresa se queda una parte, y cuánto. Es información de negociación, y se la estás dando a la persona con la que negocias. Además, un colaborador que se marcha a la competencia se lleva vuestra estructura económica en la cabeza.

**Que no cunda el pánico:** **no puede tocar nada**. El botón "Nueva Entidad" no tiene acción asociada, y el panel que sí escribe reglas está detrás del permiso correcto. Es divulgación de información, no un agujero de seguridad.

**Por qué parece un descuido y no una decisión:** en el mismo fichero hay dos pestañas de comisiones. Una comprueba el permiso; la otra no.

```
línea 115   la pestaña "Red" se pinta siempre
línea 341   su contenido, también
línea 124   la pestaña "Comisiones" sí comprueba canManageCommissions
línea 540   y su contenido, también
```

**Arreglo:** poner a la pestaña "Red" y a su contenido la misma comprobación que ya tiene su hermana. Son dos líneas.

---

## 2 · El administrador y el colaborador no ven el mismo trabajo · MEDIA

Con el mismo colaborador y en el mismo momento:

| Pantalla | Qué muestra |
|---|---|
| Admin → Hoy → "Preparar propuestas" | **12 pendientes · 24.988 € facturación/año** |
| Colaborador → Trabajo | *"No hay trabajo pendiente"* |
| Colaborador → Facturas subidas | **1 factura** |

Ninguna de las dos miente: **miran sitios distintos**. El panel del admin cuenta trabajos de OCR completados (`ocr_jobs`); el del colaborador cuenta facturas ligadas a un cliente activo, y lo avisa en pantalla.

**Por qué importa:** son doce copias de la misma factura de prueba, así que el titular **24.988 €/año es una sola factura multiplicada por doce**. Un panel de dirección que multiplica por doce el tamaño de la cartera no sirve para decidir. Y al revés: el administrador ve doce tareas que el colaborador no puede resolver porque no las ve.

**Arreglo:** que la cola del admin cuente expedientes, no lecturas de OCR — agrupando por cliente y punto de suministro. Doce lecturas de la misma factura son una tarea, no doce.

---

## 3 · Un cliente con doce facturas analizadas y cero suministros · MEDIA

El único cliente de la cartera aparece con **"0 suministros"**, pese a que sus facturas se leyeron bien y llevan CUPS.

Sin punto de suministro registrado:

- no se resuelve la distribuidora,
- no se puede consultar el SIPS,
- y el alta no puede tramitarse, porque no hay a qué punto asociarla.

O sea: doce facturas leídas y el expediente sigue sin poder avanzar, sin que nada lo diga. La ficha del cliente muestra "0 suministros" como un dato más, no como un problema.

**Arreglo:** al confirmar una factura, crear el punto de suministro si no existe. Y mientras tanto, que "0 suministros" se vea como lo que es: un expediente que no puede avanzar.

---

## 4 · Sigue entrando texto que no es un CUPS · MEDIA

Una de las facturas guarda como CUPS el valor **`****97RY`**. No es la pantalla enmascarando: **ningún componente de la aplicación enmascara CUPS**. Está así en la base de datos.

El alta manual de suministros ya lo rechaza desde hoy. **La vía del OCR y las oportunidades, no.** Es la misma puerta, en otra pared.

**Arreglo:** aplicar la misma comprobación de formato al confirmar una factura.

---

## 5 · El botón Guardar se sale de la pantalla · BAJA

En Ajustes, con la ventana estrecha, el botón **Guardar** queda cortado por el borde derecho. La fila de pestañas empuja hacia fuera. Es el mismo patrón que ya corregimos en Tarifas.

---

## Lo que está bien

No todo son pegas, y conviene decirlo:

- **La pantalla de comisiones está bien pensada.** Los estados (pendientes, en validación, disponibles, facturadas, pagadas, revertidas) cuentan el viaje del dinero de forma que un comercial lo entiende, y "Revertidas" hace visibles las decomisiones en vez de esconderlas en un saldo.
- **Los estados vacíos explican qué hacer** en lugar de dejar la pantalla en blanco: *"Cuando subas una factura, su expediente aparecerá aquí con la siguiente acción."*
- **Los datos fiscales están separados del perfil** y con un aviso que dice para qué sirven. Alguien pensó en que el comercial entienda por qué se le piden.

---

## Orden sugerido

1. **Cerrar la pestaña "Red"** — dos líneas, y es lo único con consecuencia comercial
2. **Crear el punto de suministro al confirmar la factura** — es lo que hoy deja los expedientes atascados
3. **Que la cola del admin cuente expedientes** — para que el panel de dirección diga la verdad
4. Validar el CUPS también por la vía del OCR
5. El botón Guardar

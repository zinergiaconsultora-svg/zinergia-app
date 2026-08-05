# Guía del Colaborador — App Zinergia

**Para:** comerciales y colaboradores de la red.
**Versión:** 2026-08-05 · basada en la aplicación en producción.
**Capturas:** los puntos marcados `[CAPTURA n]` tienen al final la ruta exacta y qué encuadrar.

---

## 1 · Tu pantalla: cómo se mueve la app

Abajo (móvil) o arriba (ordenador) tienes cuatro botones fijos:

| Botón | Para qué |
|---|---|
| **Trabajo** | Tu día a día: lo que tienes pendiente |
| **Clientes** | Tu cartera |
| **Comisiones** | Lo que has ganado y su estado |
| **Ajustes** | Tus datos, fiscales y de perfil |

En **"Más"** están: **Facturas subidas · Propuestas · Tarifas · Tareas**.

Y arriba a la derecha, siempre visible, el botón verde **"Nueva factura"** — es por donde empieza todo. `[CAPTURA 1]`

---

## 2 · El flujo completo: de una factura a un cliente

```
FACTURA  →  ANÁLISIS  →  COMPARATIVA  →  PROPUESTA  →  ACEPTACIÓN  →  CONTRATO  →  COMISIÓN
```

### Paso 1 — Consigue la factura

Pídele al cliente **su última factura de luz completa** (todas las páginas). Requisitos para que valga:

- **Menos de 2 meses** de antigüedad
- El **titular** se lee con claridad
- El **CUPS** completo y legible (empieza por `ES00…`)

> Una factura vieja, cortada o borrosa es la causa número uno de que un alta se caiga después. Si la foto no vale, pídela otra vez **antes** de subirla — no después.

### Paso 2 — Súbela

**Nueva factura** → arrastra el archivo o hazle una foto. Vale PDF y foto. `[CAPTURA 2]`

La app la lee sola (OCR) y extrae: titular, CUPS, tarifa de acceso, potencias contratadas, consumos por periodo y el importe.

### Paso 3 — Revisa lo que ha leído

**Esto es lo más importante de tu trabajo.** La lectura automática es buena, pero no infalible: si un dato entra mal, la comparativa saldrá mal y la propuesta será falsa.

Comprueba uno a uno: `[CAPTURA 3]`

- **Titular y CUPS** — que coincidan con la factura
- **Días del periodo** — si son 30, 31 o los que sean
- **Potencias** (P1…P6) en kW
- **Consumos** por periodo en kWh
- **Importe total** de la factura

Corrige lo que esté mal y confirma.

### Paso 4 — La comparativa

La app compara la factura contra todo el catálogo de tarifas y te ordena las ofertas. `[CAPTURA 4]`

**Cómo leer el resultado:**

- **Ahorro anual** — cuánto se ahorraría el cliente en un año
- **Tres criterios de recomendación**: máximo ahorro para el cliente · equilibrado · mejor comisión viable. La app **nunca** te ofrece como "mejor comisión" algo que le quite al cliente un ahorro razonable: hay un suelo ético incorporado.
- **Comisión estimada** de cada oferta

**Los avisos en ámbar — qué significan y qué hacer:**

| Aviso | Qué significa | Qué haces |
|---|---|---|
| **Comisión "Sin configurar"** | Esa tarifa **no tiene comisión configurada**: si la cierras, no cobras | No la ofrezcas. Avisa al administrador |
| **Servicios de ajuste** | Un coste del sistema eléctrico (unos pocos €/MWh) que **cada comercializadora factura de forma distinta**: unas lo llevan incluido, otras lo cobran aparte. Si no está configurado, la comparativa puede quedarse corta | Menciónaselo al cliente como coste variable; no prometas el importe exacto |
| **Energía reactiva / faltan datos** | La factura tiene conceptos que no se han podido leer | Vuelve a la factura y complétalos |

> **Regla de oro (y está en tu contrato):** no prometas nada que no esté en los anexos oficiales de la comercializadora. El precio simulado **no es vinculante**.

### Paso 5 — Genera y envía la propuesta

Elige la oferta y genera la propuesta. La app crea un **enlace público** para el cliente: él lo abre, ve su comparativa y la **acepta desde ahí**, quedando registrada la aceptación con fecha y evidencia. `[CAPTURA 5]`

En **Más → Propuestas** ves todas las tuyas y en qué estado están.

### Paso 6 — Documentación y alta

Para que la venta sea válida y genere comisión hacen falta (cláusula 4ª de tu contrato):

- **Contrato firmado**
- **DNI/CIF en vigor**
- **Factura reciente** (máx. 2 meses)
- **Acreditación de representación**, si firma alguien en nombre de una empresa

Sin esos documentos, el alta no se valida y **no se paga**.

### Paso 7 — Seguimiento

**Clientes** (`/dashboard/clients`) — tu cartera, con sus puntos de suministro y su estado. `[CAPTURA 6]`

---

## 3 · Tus comisiones

**Comisiones** (`/dashboard/commissions`) — cuánto llevas, qué está pendiente y qué ya se ha liquidado. `[CAPTURA 7]`

Los estados por los que pasa tu dinero:

```
GENERADA  →  VALIDADA  →  LIQUIDADA  →  PAGADA
```

- **Generada**: la venta se ha cerrado
- **Validada**: administración la ha dado por buena
- **Liquidada**: entra en la liquidación mensual
- **Pagada**: cobrada

**Lo que tienes que hacer tú:** tener completos tus **datos fiscales** en **Ajustes → Datos Fiscales para Facturación** (NIF, domicilio fiscal, IBAN, régimen de IVA/IRPF). Sin ellos no se te puede liquidar. `[CAPTURA 8]`

**Autofactura:** Zinergia emite la factura de tus comisiones en tu nombre, con tu acuerdo previo. Tú solo revisas y aceptas cada factura.

### Decomisiones (importante)

Si un cliente que has traído **se da de baja pronto**, la comercializadora le retira la comisión a Zinergia, y esa retirada te llega a ti. Se descuenta de liquidaciones posteriores.

**Consulta siempre la Política de Decomisiones vigente** — es el Anexo II de tu contrato — para saber cuánto tiempo tiene que aguantar cada contrato y en qué proporción se devuelve. La mejor defensa contra una decomisión es **una venta bien hecha**: cliente informado, sin promesas falsas, con documentación correcta.

---

## 4 · Reglas que no puedes saltarte

Salen de tu contrato de colaboración. Incumplirlas es causa de resolución inmediata:

1. **La app es solo para vender con Zinergia.** Está prohibido usar el comparador para asesorar o cerrar con comercializadoras de fuera del portfolio.
2. **Tu acceso es personal e intransferible.** No compartas usuario ni contraseña con nadie.
3. **Nada de extraer datos** masivamente, capturar pantallas de forma automatizada ni hacer ingeniería inversa.
4. **Ventas no consentidas = fraude.** Suplantar identidad o dar de alta a alguien que no lo ha pedido conlleva **penalización de 150 € por contrato + 75 € de gestión**, más cualquier sanción de organismos públicos.
5. **Protección de datos.** No crees bases de datos paralelas ni guardes la documentación de clientes en tu ordenador, tu correo o tu nube personal. La documentación vive en la app.
6. **Cero promesas fuera de anexo.** Lo que no esté por escrito en la oferta oficial, no se promete.

---

## 5 · Preguntas frecuentes

**¿Cuánto tarda una factura en analizarse?**
Segundos normalmente. Si se queda atascada, aparece en "Facturas subidas" con su estado.

**La comparativa dice que no hay ahorro. ¿Qué hago?**
Es información honesta y valiosa: si el cliente ya tiene una buena tarifa, díselo. La credibilidad es lo que te trae la siguiente venta.

**Un cliente quiere una tarifa que no aparece.**
Solo se pueden ofrecer las del catálogo. Si falta una comercializadora, coméntalo con administración.

**¿Puedo pasarle un cliente a otro compañero?**
Sí, pero es una operación controlada: la solicitas y la aprueba el administrador o tu franquicia. Queda registrada con motivo.

**¿Qué es el CUPS?**
El código único del punto de suministro (`ES00…`). Los 4 dígitos que van detrás de `ES` identifican a la **distribuidora**: la empresa que mantiene el cable y el contador, distinta de la comercializadora con la que el cliente contrata.

**No tienes que buscarla:** la app la deduce sola del CUPS y te la muestra en la ficha del punto de suministro. Si no aparece, es que ese prefijo no consta en el catálogo — la app prefiere no decir nada antes que decirte una distribuidora equivocada.

**¿Y si el cliente tiene placas solares?**
Díselo a administración antes de cerrar: la compensación de excedentes todavía no está configurada en el catálogo y la comparativa saldría incompleta.

---

## Lista de capturas para insertar

| # | Dónde | Qué encuadrar |
|---|---|---|
| 1 | `/dashboard` | La barra de navegación con los 4 botones y el botón verde "Nueva factura" |
| 2 | `/dashboard/simulator` | La zona de subir factura |
| 3 | `/dashboard/simulator` tras subir | La pantalla de confirmar datos leídos |
| 4 | Comparativa | La lista de ofertas con ahorro, comisión y un aviso ámbar |
| 5 | `/dashboard/proposals` | La lista de propuestas con sus estados |
| 6 | `/dashboard/clients` | La cartera de clientes |
| 7 | `/dashboard/commissions` | El resumen de comisiones |
| 8 | `/dashboard/settings` | La pestaña "Datos Fiscales para Facturación" |

> Para capturar la vista de colaborador hay que iniciar sesión con una cuenta de colaborador (no con la de administrador, que ve otras pantallas).

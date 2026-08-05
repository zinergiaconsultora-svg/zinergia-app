# Guía del Colaborador — App Zinergia

**Para:** comerciales y colaboradores de la red.
**Versión:** 2026-08-05 · basada en la aplicación en producción.
**Capturas:** los puntos marcados `[CAPTURA n]` tienen al final la ruta exacta y qué encuadrar.

---

## 0 · Las diez palabras que hay que saber

Si vienes de otra comercializadora, algunas se dicen distinto. Esta columna te vale para las dos.

| Palabra | Qué es, en cristiano |
|---|---|
| **CUPS** | El código del punto de luz. Empieza por `ES` y no cambia aunque cambies de compañía. Es como el DNI del contador |
| **Comercializadora** (o *compañía*) | La empresa que le vende la luz al cliente y le manda la factura: LOGOS, NATURGY, Plenitude, GANA |
| **Distribuidora** | La dueña del cable y del contador. **No se elige**: te toca la de tu zona. Es quien da de alta el cambio |
| **Peaje** (o *ATR*, o *tarifa de acceso*) | El "tamaño" de la conexión: 2.0TD casas y comercios pequeños, 3.0TD y 6.1TD negocios grandes |
| **Potencia** | Los kW contratados. Se paga aunque no consumas |
| **Periodos** (P1, P2, P3…) | Las franjas horarias. La luz no cuesta lo mismo por la mañana que de madrugada |
| **Captación** | Traer un cliente nuevo. Lo normal es *cambio de comercializadora* |
| **Cartera** | Los clientes que ya son tuyos y siguen dando comisión mes a mes |
| **Activación** | El día que la distribuidora hace efectivo el cambio. **Desde ahí se cuenta todo**: cuándo cobras y hasta cuándo te lo pueden quitar |
| **Decomisión** (verás *clawback* o *baja < 1 año*) | Que te retiren una comisión ya cobrada porque el cliente se fue antes de tiempo |

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

- **Menos de 3 meses** de antigüedad
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

**Qué mirar de cada oferta:**

- **Ahorro anual** — lo que se ahorra el cliente en un año
- **Comisión estimada** — lo que ganas tú
- **Tres formas de ordenar**: *más ahorro para el cliente*, *equilibrado*, y *mejor comisión*. Esta última **nunca te enseña una oferta que deje al cliente sin un ahorro decente**. Está puesto a propósito: una venta que solo te conviene a ti se cae a los tres meses y te la quitan.

**Si sale un aviso en ámbar:**

| Dice | Significa | Qué haces |
|---|---|---|
| **Comisión "Sin configurar"** | Esa tarifa no tiene comisión puesta. Si la cierras, **no cobras nada** | No la ofrezcas. Dile al administrador que la configure |
| **Servicios de ajuste** | Un coste del sistema (unos pocos euros al mes). Cada comercializadora lo cobra a su manera: unas lo llevan dentro del precio y otras lo ponen aparte. Si no está configurado, la comparativa puede quedarse corta | Avísale al cliente de que es un coste que varía. No le des una cifra exacta |
| **Faltan datos / energía reactiva** | Hay conceptos de la factura que no se han podido leer | Vuelve atrás y complétalos a mano |

> **La regla que no se salta nadie:** no prometas nada que no esté por escrito en la oferta oficial de la comercializadora. Lo que ves en pantalla es una simulación, **no un precio cerrado**. Está en tu contrato, cláusula CUARTA.

### Paso 5 — Genera y envía la propuesta

Elige la oferta y genera la propuesta. La app crea un **enlace público** para el cliente: él lo abre, ve su comparativa y la **acepta desde ahí**, quedando registrada la aceptación con fecha y evidencia. `[CAPTURA 5]`

En **Más → Propuestas** ves todas las tuyas y en qué estado están.

### Paso 6 — Documentación y alta

Para que la venta sea válida y genere comisión hacen falta (cláusula 4ª de tu contrato):

- **Contrato firmado**
- **DNI/CIF en vigor**
- **Factura reciente** (máx. 3 meses)
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

### Decomisiones: cuándo te quitan una comisión

Si un cliente tuyo **se da de baja pronto**, la comercializadora le retira el dinero a Zinergia, y esa retirada te llega a ti. Se te descuenta de la siguiente liquidación.

En otras empresas lo verás escrito como ***clawback*** o ***baja < 1 año***. Es lo mismo.

**Cuánto tiene que aguantar cada contrato está en el Anexo II de tu contrato** (la Política de Decomisiones), y cambia según la comercializadora. El plazo **se cuenta desde la fecha de activación**, no desde que firmas.

La mejor defensa es una venta bien hecha: cliente informado, sin promesas de más, y papeles correctos a la primera.

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

**¿Cómo sé la distribuidora de un cliente?**
Te la dice el propio CUPS: los 4 números que van justo detrás de `ES`. **No tienes que buscarla** — la app la saca sola y te la enseña en la ficha del punto de suministro.

Si no aparece ninguna, es que ese código no está en la lista. La app prefiere no decirte nada antes que decirte una distribuidora equivocada en una propuesta.

**Me da error al meter el CUPS.**
Tiene que empezar por `ES` y llevar 18-22 caracteres detrás. No valen abreviaturas, ni "pendiente", ni el número a medias: un CUPS mal metido se guarda cifrado y luego no sirve para nada.

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

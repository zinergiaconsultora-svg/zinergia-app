# Verificación documental automática — requisitos

**Origen:** hallazgo del análisis competitivo de Energilandia (2026-08-04).
**Estado:** `requirements_draft` — pendiente de aprobación de producto y del responsable de datos.
**Autor del borrador:** Claude (Opus 5).

---

## Por qué

En la ficha de contrato de Energilandia, cada documento subido lleva etiqueta de tipo (`DNI`, `Justificación en cuenta`), doble check verde, un distintivo global **"Documentación verificada"**, y un veredicto en lenguaje natural al pasar el ratón, del estilo:

> *"DNI español completo, con anverso y reverso visibles, número […] coherente con el formato y la letra de control, y datos personales concordantes entre ambas caras."*

Leen la imagen, validan la letra de control, comprueban que están las dos caras y cruzan que los datos coinciden.

**Por qué importa:** la documentación mal aportada es una de las causas principales de que un alta caiga en `Incidencia` o la rechace la comercializadora. Cada rechazo es retrabajo del comercial y, si acaba en baja temprana, una decomisión. Automatizar la validación ataca el problema donde nace, en el momento de subir el fichero, en lugar de tres días después por email.

**Por qué es viable aquí:** la infraestructura ya existe. `ocr_jobs` gestiona subida, reintentos, hash de contenido, detección de duplicados y **purga del binario** (`binary_purged_at`). Hay integración con Drive, `ocr_training_examples` y `sanitizeTrainingData.ts`. Falta el caso de uso, no el motor.

---

## Lo que NO debemos copiar de ellos

Su tooltip **contiene el número del DNI en claro**. Y los ficheros descargables incorporan el CUPS en el nombre (`dni_1_ES00311…jpeg`).

Zinergia cifra CUPS y DNI a nivel de aplicación con índice ciego. Replicar su enfoque —guardar un veredicto en lenguaje natural generado por un modelo, que cita el número— **metería PII en claro en la base de datos y en la interfaz**, tirando por tierra ese trabajo.

**Decisión de diseño:** el veredicto se guarda como **comprobaciones estructuradas y códigos seguros**, nunca como texto libre de un modelo ni con el número dentro.

---

## Alcance

**Dentro:**
- Clasificación del tipo de documento subido (DNI/NIE anverso, DNI/NIE reverso, CIF, justificante bancario, factura, poder, otros).
- Comprobaciones deterministas que no requieren modelo: letra de control del DNI/NIE, formato de IBAN con mod-97, formato de CIF con su dígito de control.
- Comprobaciones de coherencia contra lo ya declarado en el sistema, **por índice ciego**: el documento coincide con el titular declarado.
- Comprobaciones asistidas por modelo: legibilidad, documento completo, presencia de ambas caras, coherencia entre caras.
- Estado agregado de "documentación verificada" por contrato, y su reflejo en la interfaz.
- Registro auditable del veredicto, sin PII.

**Fuera:**
- Detección de falsificación o manipulación de imagen.
- Verificación de identidad contra fuentes oficiales.
- Bloquear el alta automáticamente (ver REQ-006).
- Documentos de las verticales de gas y eficiencia, en la primera entrega.

---

## Requisitos

**[REQ-001]** CUANDO se sube un documento a un contrato, el sistema deberá clasificar su tipo y ejecutar las comprobaciones aplicables **antes** de que el binario sea purgado.

*Verificación:* un documento subido produce un veredicto antes de que `binary_purged_at` se rellene; si la verificación falla, la purga sigue ocurriendo igual y el veredicto queda como `no_verificable`.

**[REQ-002]** El sistema deberá ejecutar primero las comprobaciones **deterministas**, y sólo invocar al modelo para lo que no se pueda decidir sin él.

*Verificación:* la letra de control del DNI/NIE, el mod-97 del IBAN y el dígito de control del CIF se calculan en código, con test unitario, y no consumen llamada al modelo. Un DNI con letra incorrecta se rechaza sin invocar a ningún modelo.

> El mod-97 del IBAN **ya existe** en `update_own_iban`. Debe reutilizarse, no reimplementarse.

**[REQ-003]** CUANDO el documento contenga un identificador de persona, el sistema deberá comprobar la coincidencia con el titular declarado **comparando índices ciegos**, y no deberá persistir el identificador extraído en claro en ningún momento.

*Verificación:* el número extraído se convierte con `hashDni()` y se compara con `dni_cif_hash`; no aparece en ninguna columna, log, traza ni respuesta de API. Existe un test que introduce un DNI conocido y confirma que no aparece en el veredicto almacenado.

**[REQ-004]** El veredicto deberá almacenarse como **comprobaciones estructuradas con códigos cerrados**, nunca como texto libre generado por un modelo.

*Verificación:* el esquema admite un conjunto enumerado de comprobaciones y resultados (`pass` | `fail` | `not_applicable` | `unreadable`), con una restricción `CHECK`. No hay ninguna columna que reciba la salida literal del modelo.

**[REQ-005]** El sistema deberá exponer un estado agregado por contrato, y ese estado deberá distinguir **"verificado"** de **"sin verificar"** y de **"con incidencias"**.

*Verificación:* un contrato al que le falta el reverso del DNI no aparece como verificado; la interfaz dice qué falta, en lenguaje del comercial, sin citar datos personales.

**[REQ-006]** MIENTRAS la primera entrega esté vigente, el veredicto será **informativo y no bloqueará** el avance del contrato.

*Verificación:* un contrato con veredicto negativo puede avanzar igualmente; el aviso es visible pero no impide la acción.

> Un falso negativo que bloquea una venta legítima hace más daño que un falso positivo que pasa a revisión humana. El bloqueo automático es una decisión posterior, cuando existan métricas de precisión reales.

**[REQ-007]** SI la verificación no puede completarse —modelo caído, documento ilegible, formato no soportado— ENTONCES el sistema deberá registrar `no_verificable` con un código seguro y **no deberá presentarlo como verificado**.

*Verificación:* con el proveedor de modelo caído, el documento queda `no_verificable`; no hay ninguna ruta por la que un fallo produzca un check verde.

**[REQ-008]** El sistema deberá registrar cada verificación de forma auditable: actor, momento, tipo de documento, resultado y motivo, **sin PII**.

*Verificación:* la traza permite investigar por qué un contrato se marcó de una forma sin revelar identidad alguna.

**[REQ-009]** CUANDO este cambio toque estructura, políticas, funciones o privilegios de base de datos, deberá hacerlo mediante una migración nueva, con regeneración de tipos, y verificando el acceso efectivo de `anon`, `authenticated` y `service_role`.

**[REQ-010]** La verificación deberá poder **apagarse por completo** con un interruptor, sin desplegar código.

*Verificación:* con el interruptor apagado, no se invoca al modelo, no se escriben veredictos y la interfaz no muestra el bloque de verificación — el mismo patrón que `SIPS_LIVE_ACCESS_ENABLED`.

---

## Invariantes

- **[INV-001]** Ningún número de documento de identidad se persiste ni se muestra en claro en ningún punto del flujo de verificación.
- **[INV-002]** Un fallo de verificación nunca produce un resultado positivo.
- **[INV-003]** Lo que se puede comprobar de forma determinista no se delega en un modelo.
- **[INV-004]** El veredicto es evidencia: se añade, no se reescribe.
- **[INV-005]** La verificación nunca retrasa ni impide la purga del binario.

---

## Decisiones pendientes de producto

1. **Proveedor del modelo.** El repositorio ya integra OCR vía n8n. Hay que decidir si la verificación va por ahí o por una llamada directa, y con qué proveedor. Afecta a coste por documento y a dónde viajan las imágenes de DNI — que es una decisión de RGPD, no técnica.
2. **Encargado del tratamiento.** Enviar imágenes de DNI a un tercero exige contrato de encargo y reflejarlo en el registro de actividades. **Es requisito legal previo, no un detalle de implementación.**
3. **Retención del veredicto** una vez el contrato está activado o dado de baja.
4. **Qué documentos son obligatorios** por comercializadora y segmento. Energilandia mantiene esa matriz en un PDF; aquí debería ser un dato, y enlaza con la mejora de "capacidades por comercializadora".

---

## Entrega sugerida

**Fase 1 — determinista, sin modelo ni coste.** Letra de control de DNI/NIE, dígito de control de CIF, mod-97 de IBAN reutilizando `update_own_iban`, y coincidencia por índice ciego con el titular declarado. Cubre una parte real de los rechazos, no envía nada a terceros, y **no necesita ninguna decisión legal previa**.

**Fase 2 — asistida por modelo.** Legibilidad, documento completo, ambas caras, coherencia entre caras. Requiere resueltas las decisiones 1 y 2.

**Fase 3 — matriz de requisitos documentales** por comercializadora y segmento, que convierte el veredicto en "le falta X para esta comercializadora".

Empezar por la fase 1 da valor la primera semana y deja el trabajo legal en paralelo, en lugar de bloquearlo todo detrás de él.

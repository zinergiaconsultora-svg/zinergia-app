# Contrato de colaboración — revisión y anexos propuestos

**Documento revisado:** `Contrato borrador ZINERGIA .docx`
**Fecha de revisión:** 2026-08-05
**Para:** entregar al abogado junto con el borrador.

> **No soy abogado.** Esto es una revisión funcional: señala huecos entre lo que dice el contrato y lo que la aplicación y la normativa exigen. La redacción final debe validarla un profesional.

---

## Resumen para el abogado

El borrador es sólido en propiedad intelectual, uso de la aplicación, calidad de venta y fraude. Los huecos que hemos identificado son **seis**, y uno de ellos (el nº 4) puede tener consecuencias económicas relevantes.

---

## 1 · La cláusula de decomisiones es demasiado vaga · ALTA

**Dónde:** cláusula 6ª, apartado "Bajas y rechazos".

**Qué dice hoy:** que no se liquidarán, o se detraerán, los contratos que resulten en baja anticipada.

**Qué falta:** no define qué es "anticipada" (¿3 meses? ¿12?), ni si la devolución es total o proporcional, ni desde qué fecha se cuenta, ni hasta cuándo puede reclamarse, ni cómo se compensa.

**Propuesta:** remitir a un **Anexo II — Política de Decomisiones** (plantilla ya redactada: `politica-decomisiones-PLANTILLA.md`), con mención expresa a: compensación con liquidaciones futuras, plazo máximo de reclamación, y derecho de alegación del colaborador.

## 2 · Falta el acuerdo de autofacturación · ALTA

**Qué pasa:** la aplicación **emite las facturas de comisiones en nombre del colaborador** (autofacturación). El RD 1619/2012, art. 5, exige para eso un **acuerdo previo y expreso** entre las partes y un procedimiento de **aceptación de cada factura**.

**El contrato no lo menciona.** La app ya lo modela (acuerdos de autofacturación y aceptación por factura), pero sin la cláusula el soporte documental queda cojo.

**Propuesta:** cláusula nueva o **Anexo III**, con: consentimiento expreso a la autofacturación, procedimiento de aceptación/rechazo y plazo, obligación del colaborador de mantener sus datos fiscales al día, y duración del acuerdo.

## 3 · El apartado de RGPD se queda corto · MEDIA

**Dónde:** cláusula 7ª.

Identifica correctamente al colaborador como Encargado del Tratamiento, pero el **art. 28.3 RGPD** exige un contenido mínimo que un párrafo no cubre: objeto y duración, naturaleza y finalidad, tipo de datos y categorías de interesados, instrucciones documentadas, confidencialidad del personal, medidas de seguridad (art. 32), régimen de subencargados, asistencia en derechos y brechas, supresión o devolución al final, y sometimiento a auditorías.

**Propuesta:** **Anexo de encargo de tratamiento** completo. Añadir además la obligación de recabar el **consentimiento del titular para la consulta SIPS** por los cauces de la aplicación.

## 4 · Ley del Contrato de Agencia (12/1992) · ALTA — decisión del abogado

Aunque el contrato se titule "de colaboración", describe **intermediación continuada y retribuida por cuenta ajena**, que es lo que la Ley 12/1992 define como agencia. Es imperativa: no se esquiva por el título.

Dos consecuencias que el borrador no trata:

- **Indemnización por clientela (art. 28).** Puede alcanzar la media anual de comisiones de los últimos 5 años. **No es renunciable por anticipado.** El borrador solo la excluye en caso de fraude (cláusula 6ª).
- **Preaviso de extinción (art. 25).** Con la prórroga tácita, el contrato pasa a indefinido y el preaviso legal mínimo es de **un mes por año de vigencia** (máx. 6). El borrador pacta **15 días**, que probablemente no resista.

**Propuesta:** que el abogado decida entre (a) asumir el régimen de agencia y ajustar plazos y compensaciones, o (b) reconfigurar la relación para que sea genuinamente mercantil no-agencia. Es una decisión de negocio con impacto económico, no de redacción.

## 5 · No se dice de quién es la cartera de clientes · MEDIA

El contrato no dice nada sobre la titularidad de los clientes al terminar la relación, ni sobre no-captación posterior.

La aplicación ya gobierna la cartera (asignación por colaborador, traspasos aprobados y registrados). **El contrato debería decir explícitamente que los clientes son de la empresa**, y regular qué pasa con la cartera al finalizar. Sin eso, la disputa es previsible.

*(Ojo: una cláusula de no-competencia post-contractual tiene sus propios límites legales — art. 20-21 de la Ley de Agencia: máximo 2 años, por escrito, y limitada a la zona y a los productos. Que lo valore el abogado.)*

## 6 · Falta la cláusula de firma electrónica · MEDIA

El contrato se va a firmar electrónicamente. Conviene una cláusula donde ambas partes **reconozcan la validez y eficacia probatoria** de la firma electrónica utilizada, conforme al **Reglamento (UE) 910/2014 (eIDAS)** y la **Ley 6/2020**, y acepten el certificado de evidencias como prueba.

---

## 7 · Además, dos correcciones formales

- **"SINGERGIA PRISMA SL"** — verificar contra la escritura. Puede ser un error por "SINERGIA".
- **"ZINERGI"** en el título del borrador.
- **Criterio de antigüedad de factura**: fijado en **3 meses** (decisión de Zinergia, 05/08/2026). El borrador original decía 2 y el competidor usa 6. Ya está aplicado en el contrato v2 y en ambas guías.

  **La aplicación todavía no lo comprueba.** El OCR no persiste la fecha de la factura en un campo tipado —`ocr_jobs.extracted_data` es JSON libre—, así que no hay nada contra lo que validar. Mientras tanto es una comprobación manual del administrador. Construirla exige extraer y almacenar la fecha; queda anotado como trabajo pendiente.

---

## 8 · Lo que NO está en el borrador y la normativa nueva sí exige

**Real Decreto 88/2026, de 11 de febrero** (Reglamento general de suministro, comercialización y agregación de energía eléctrica).

El cambio de fondo: **ya no basta con informar al consumidor, hay que poder acreditar cada fase de su consentimiento.** Incluye documento resumen precontractual, impulso a la firma electrónica y servicios de confianza, y prohibición de llamadas comerciales no solicitadas.

En la práctica del sector, para clientes **residenciales y autónomos** (y sus renovaciones) esto se está resolviendo con un paquete de **tres documentos firmados por el cliente antes de tramitar el alta**:

1. **Consentimiento expreso** para la solicitud de oferta personalizada
2. **Contrato de asesoramiento energético** — que deja claro que aceptarlo **no** implica contratar suministro, ni autoriza cambio de comercializadora, ni modificar potencia
3. **Política de privacidad**

Con firma manuscrita digitalizada y **certificado de evidencias** archivado en el expediente.

**Propuesta:** añadir al contrato de colaboración la **obligación del colaborador de recabar ese paquete** por los cauces de la aplicación antes de tramitar cualquier alta de residencial o autónomo, y redactar los tres documentos (los firmará el **cliente**, no el colaborador — son documentos distintos de este contrato).

---

## Estructura documental resultante

| Documento | Quién firma | Estado |
|---|---|---|
| Contrato de colaboración | Colaborador | Borrador, pendiente de las 6 correcciones |
| **Anexo I** — Comisiones | Colaborador | Pendiente de los importes; se generará desde los planes de comisión de la app |
| **Anexo II** — Política de Decomisiones | Colaborador | Plantilla lista, pendiente de valores |
| **Anexo III** — Acuerdo de autofacturación | Colaborador | Por redactar |
| **Anexo IV** — Encargo de tratamiento (RGPD) | Colaborador | Por redactar |
| Consentimiento expreso oferta personalizada | **Cliente** | Por redactar (RD 88/2026) |
| Contrato de asesoramiento energético | **Cliente** | Por redactar (RD 88/2026) |
| Política de privacidad | **Cliente** | Por redactar (RD 88/2026) |

---

## Referencias

- [Real Decreto 88/2026, de 11 de febrero (BOE)](https://www.boe.es/buscar/act.php?id=BOE-A-2026-3212)
- [Contratación energética bajo el RD 88/2026 — ECIJA](https://www.ecija.com/actualidad-insights/contratacion-energetica-bajo-el-rd-88-2026-identificar-informar-y-poder-acreditar/)
- [RD 88/2026: Reglamento de suministro y contratación eléctrica — Logalty](https://www.logalty.com/2026/03/19/reglamento-de-suministro-y-contratacion-electrica-rd-88-2026/)
- [La CNMC reitera a las comercializadoras sus obligaciones contractuales](https://www.cnmc.es/prensa/consulta-obligaciones-electricidad-20260610)

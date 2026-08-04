# Propuesta de desarrollo — Zinergia

**Autor:** Claude (Opus 5) · **Fecha:** 2026-08-04
**Base:** auditoría de ZIN-SDD-041 + análisis competitivo de Energilandia + inspección del esquema real de zinergia.

---

## Corrección previa, importante

En mi análisis de Energilandia dejé una lista de "pendiente de verificar" asumiendo que zinergia iba por detrás en modelo de dominio. **Al inspeccionar el esquema, la mayor parte de esa lista ya está construida.** Corrijo antes de proponer nada:

| Lo que dudé | Realidad en zinergia |
|---|---|
| ¿Decomisión modelada? | ✅ `commission_decommission_policies` + `commission_decommission_bands` + `configure_decommission_policy` + `propose_permanence_decommission` |
| ¿Comisión versionada? | ✅ `commission_plans` + `version_commission_plan` + `commission_plan_assignments` + `configure_commission_model` |
| ¿Ciclo de vida de comisión? | ✅ `commission_events` + `initialize_commission_lifecycle` + `transition_commission_lifecycle` |
| ¿Autofacturación fiscal? | ✅ `self_billing_agreements`, `create_commission_invoice_draft`, `fiscal_document_sequences`, `invoice_registry` — **y `verifactu_invoices`** |
| ¿SIPS? | ✅ `sips_consents` + `sips_consumption_cache` + `sips_query_audit` |
| ¿Renovaciones? | ✅ `renewal_opportunities`, `contract_renewal_reminders`, `reconcile_contract_renewals`, `confirm_contract_permanence` |
| ¿Discrepancias de liquidación? | ✅ `commission_adjustments` + `propose/resolve_commission_adjustment` |
| ¿Conciliación con la comercializadora? | ✅ `commission_supplier_statements` + `_lines` + `commission_reconciliation_queue` |
| ¿IGIC / IPSI? | ✅ presentes en el baseline |
| ¿Excedentes de autoconsumo? | ✅ `surplus_compensation_price` en tarifas |

**Zinergia no va por detrás de Energilandia en dominio. En varias piezas va por delante**, y con diferencias que se pueden vender:

- **VeriFactu.** Zinergia tiene `verifactu_invoices`. Energilandia no muestra ni rastro del reglamento antifraude de la AEAT en su módulo de autofacturas. Cuando sea obligatorio, ellos tienen un problema y tú no.
- **Consentimiento SIPS auditado.** Ellos consultan el SIPS con un campo y un botón. Tú tienes `sips_consents` y `sips_query_audit`. El SIPS contiene datos personales del titular: consultarlo sin consentimiento trazable es un riesgo de la AEPD que ellos parecen no haber modelado.
- **Cifrado de PII a nivel de aplicación.** CUPS y DNI cifrados con AES-256-GCM + índice ciego. Energilandia muestra el DNI en claro en el listado de contratos.
- **Conciliación de extractos.** Cruzar lo que la comercializadora dice que te paga contra lo que tú esperabas cobrar. En Energilandia eso es un tipo de incidencia ("Discrepancia en liquidación"); en zinergia es una tabla.

**Corolario: la propuesta no es "construir el dominio". Es cerrar tres huecos concretos y arreglar el proceso de entrega, que es hoy el eslabón débil.**

---

## Los tres huecos reales

### Hueco 1 · Servicios de ajuste — el más urgente, y no es de mercado, es de corrección

**Estado: cero coincidencias en todo el repositorio.** Ni en `src/`, ni en migraciones.

Del documento interno de Energilandia, tres tratamientos coexisten en el mercado:

1. Incluidos en el precio de energía.
2. Facturados aparte.
3. Incluidos **con techo** — Endesa 12 €/MWh, otras 19 €/MWh, otras 16 €/MWh, Fijo/Passpool 21,15 €/MWh — y si el mercado supera el techo, la diferencia se repercute al cliente.

Su propio PDF lo avisa en mayúsculas: *"¡IMPORTANTE! Los SSA son un concepto VARIABLE"*.

**Por qué es urgente:** comparar una oferta con SSA incluidos contra otra que los factura aparte, sin normalizar, produce un ahorro calculado **sistemáticamente falso**. El cliente lo descubre en su primera factura. Y el recorrido del daño está modelado en tu propio esquema: reclamación → baja temprana → `commission_decommission_bands` → te quitan la comisión. **Un comparador que no normaliza SSA no es una funcionalidad incompleta: es una máquina de generar decomisiones.**

Es además el hueco más barato de los tres. Tres campos en la tarifa (`ssa_treatment` enum, `ssa_included_eur_mwh`, `ssa_cap_policy`) y un término más en el motor de cálculo, con su test espejo en `tests/unit/` como manda la convención del repo.

### Hueco 2 · Gas — el mayor hueco de mercado

**Estado: cero.** No existe ninguna tarifa `RL.1`–`RL.11`, `RLPS.*`, `RLTA.*` ni `RLTB.*`. Zinergia cubre 2.0TD, 3.0TD, 6.1TD y 6.2TD; es decir, **solo electricidad**.

Energilandia vende luz y gas por el mismo flujo, con el mismo comparador y el mismo contrato. Cada cliente PYME con suministro dual es hoy media venta para ti y una venta entera para ellos — y encima el que se lleva el gas se lleva la relación.

No es un rediseño: los peajes de gas son otra dimensión del mismo modelo de tarifa que ya tienes. El trabajo real está en el catálogo y en las particularidades del cálculo, no en la arquitectura.

### Hueco 3 · Carterización — el que genera conflictos internos

**Estado: cero coincidencias.** No hay propiedad de cliente ni traspaso de cartera.

Energilandia lo trata como proceso gobernado: dos tipos de petición formales (`SOLICITUD ASIGNACIÓN CARTERA COMERCIAL`, `SOLICITUD TRASPASO CARTERA COMERCIAL`) y una columna `Tipo contrato` en el listado que marca `NO CARTERIZADO`.

Con una red de franquicias y agentes, la pregunta "¿de quién es este cliente?" aparece sola, y sin respuesta en el sistema se resuelve discutiendo. Peor: afecta al reparto de comisión, que en tu caso ya es configurable por franquicia. Un traspaso sin registro es una comisión mal pagada.

**Por verificar antes de dimensionarlo** (no lo he comprobado): si existen los segmentos Ayuntamiento y CCPP, y si hay una matriz de capacidades por comercializadora.

---

## El problema que no es de producto

La auditoría de ZIN-SDD-041 apunta a algo estructural, y creo que es más importante que los tres huecos.

Zinergia tiene **~95 tablas y funciones** en el esquema. Es un sistema grande y con dominio profundo. Pero el trabajo que acabo de auditar dejó al descubierto que **la superficie crece más rápido que los gates**:

- La Edge Function que ejecutará la reconciliación en producción no está type-checked, ni linted, ni testeada. Lo que está cubierto es la ruta que se apaga.
- La suite de tests falla de forma no determinista, y aun así se presentó como evidencia.
- La única herramienta que puede decidir si el contrato es aplicable a producción se niega por diseño a mirar producción.
- Cuatro directorios de salida de compilación estaban a un `git add -A` de entrar en el repositorio.

Ninguno de esos cuatro es un fallo de diseño. **Los cuatro son fallos de proceso**, y todos comparten la misma causa: se añadió superficie nueva sin extender el gate que la cubre.

Con 95 tablas y un dominio con dinero de por medio, eso no escala. La recomendación más valiosa que puedo darte no es una funcionalidad: es **que la regla de "no entra código sin gate que lo cubra" sea dura**, igual que ya lo es "toda migración pasa por `supabase/migrations/`" y "ningún cálculo nuevo sin test espejo". Esas dos reglas funcionan; falta la tercera.

---

## Plan por fases

### Fase 0 · Cerrar ZIN-SDD-041 (días)

Bloqueantes, ya implementados en esta sesión salvo el último:

1. ✅ Gate de contrato ejecutable contra producción — `supabase/scripts/profile_authority_contract_gate.ps1`. Falla cerrado, exige `-ConfirmProduction`, y devuelve `BLOCKED`/`PASS` en lugar de un volcado.
2. ✅ Script de reversión probado — `supabase/scripts/profile-authority/rollback_contract_to_compatible.sql`, con aserciones que impiden confundir un rollback parcial con éxito.
3. ✅ Aviso de 15 minutos portado a la Edge Function.
4. ✅ `deno check` + `deno lint` en CI sobre `supabase/functions/`.
5. ✅ `retry_exhausted` convertido en estado terminal real (migración `20260804010000`).
6. ✅ Suite estabilizada (`testTimeout` 20 s) y artefactos de build ignorados en git.
7. ⏳ **Ejecutar el gate contra producción.** Es el único paso que requiere sesión de Supabase y es el que decide GO/NO-GO.

### Fase 1 · Servicios de ajuste — ✅ IMPLEMENTADA

| Pieza | Fichero |
|---|---|
| Columnas `ssa_treatment` + `ssa_included_eur_mwh`, con CHECK de valores y CHECK de forma (el techo sólo existe, y es obligatorio, en `included_with_cap`) | `supabase/migrations/20260804020000_add_adjustment_services_to_tariffs.sql` |
| Tipo `SsaTreatment`, función pura `calculateAdjustmentServicesCost`, línea "Servicios de ajuste" y dos alertas nuevas | `src/lib/comparison/invoice-simulator.ts` |
| Cableado catálogo → candidato → motor, con degradación si la migración aún no está aplicada | `src/app/actions/simulator.ts`, `src/lib/aletheia/{types,engine}.ts` |
| 17 tests | `src/lib/comparison/__tests__/adjustment-services.test.ts` |

**Decisiones que conviene conocer:**

- **`unknown` es el valor por defecto y no suma coste, pero emite `missing_ssa_treatment` (warning).** Un cero silencioso sería indistinguible de `included`, que es justo la confusión que esta columna existe para eliminar. El comercial ve que la comparativa **no está normalizada** en vez de creerse un ahorro que no existe.
- **La referencia de mercado es un parámetro, no una constante escondida.** Si no se aporta, se usa `DEFAULT_SSA_MARKET_RATE_EUR_MWH = 12` y se emite `ssa_market_rate_assumed` (info). Los SSA son variables; el sistema dice cuándo está asumiendo.
- **Los SSA entran antes del impuesto eléctrico y del IVA**, como cualquier otro concepto de energía. Hay test que lo fija (`× 1,0511 × 1,21`).
- **Los SSA facturados aparte en la factura *actual* cuentan como coste actual** al reconstruir el total. Omitirlos infla todos los ahorros.

**Criterio de hecho, cumplido:** dos ofertas con idéntico precio de energía, una con SSA incluidos y otra que los factura aparte, ya no empatan — se separan exactamente por el importe de SSA, y hay test que lo demuestra.

**Pendiente operativo:** poblar `ssa_treatment` en el catálogo. Hasta entonces toda tarifa avisa, que es el comportamiento correcto.

### Fase 2 · Gas — ⛔ FUERA DE ALCANCE (decisión de negocio, 2026-08-04)

El cliente decide no comercializar gas por ahora. El análisis de abajo se conserva porque el hueco de mercado sigue siendo real y la decisión es reversible; **no** se ha escrito código de gas.

<details>
<summary>Análisis original (para cuando se retome)</summary>

#### Gas (3–5 semanas)

Peajes `RL.1`–`RL.11`, `RLPS`, `RLTA`, `RLTB` en el modelo de tarifa. Catálogo, comparador y contrato reutilizando el flujo existente. Cliente con suministro dual como caso de primera clase.

**Criterio de hecho:** una comparativa de gas completa, de la factura al contrato, sin ninguna rama de código específica de gas fuera del cálculo.

</details>

### Fase 3 · Carterización — ✅ NÚCLEO IMPLEMENTADO

Resultó que `clients.owner_id` **ya existía** (y `franchise_id`), así que la propiedad estaba modelada. Lo que faltaba era el **gobierno**: cualquiera con acceso de escritura podía mover un cliente entre agentes, en silencio, sin rastro de quién ni por qué. En una red con franquicias eso no es una disputa de CRM, es una disputa de comisión.

| Pieza | Fichero |
|---|---|
| `clients.ownership_version`, tabla `client_ownership_events` inmutable, guard trigger y `transfer_client_ownership` | `supabase/migrations/20260804050000_client_portfolio_ownership.sql` |
| Action de traspaso e historial | `src/app/actions/clientOwnership.ts` |
| 14 tests | `src/app/actions/__tests__/clientOwnership.test.ts` |

Se reutiliza exactamente el molde de `profile_authority_events`: versión optimista, comando específico, contexto verificado por trigger y evidencia inmutable por trigger.

**Reglas implementadas:**

- **Un agente no puede mover sus propios clientes.** Es precisamente el conflicto que esto previene.
- **Franquicia** mueve dentro de su red, y solo hacia miembros de su red.
- **Admin** puede mover entre franquicias; el cliente **sigue al nuevo propietario**, así que nunca queda en una franquicia a la que su dueño no pertenece.
- **Versión optimista:** dos responsables no pueden consumir la misma versión esperada. El segundo recibe "recarga y vuelve a intentarlo", no un pisotón silencioso.
- **Idempotencia por `request_id`**, con conflicto explícito si se reutiliza con otra intención.
- **El guard aplica también a `service_role`** — los triggers no se saltan por rol.

**Fuera de este slice, deliberadamente:** el flujo de *solicitud y aprobación* (un agente pide un traspaso y la franquicia lo aprueba), que es lo que Energilandia modela como `SOLICITUD ASIGNACIÓN/TRASPASO CARTERA COMERCIAL`. Es aditivo sobre lo anterior y no cambia nada de lo construido.

**Criterio de hecho, cumplido:** un cliente no puede cambiar de dueño sin dejar evento con actor, origen, destino y motivo; y no puede cambiar de dueño en absoluto fuera del comando.

### Fase 4 · Capacidades por comercializadora como datos (2 semanas)

Lo que Energilandia mantiene en un PDF con el descargo *"puede contener errores o no estar actualizada"*, en tabla: ámbito geográfico, segmentos admitidos, gas sí/no, canales de firma, documentación exigida, pre-scoring, activación futura, cambio de titular o potencia en la contratación.

**Aquí está el adelantamiento.** Ellos obligan al comercial a recordar consultar un PDF. Tú puedes hacer que **el formulario de alta impida seleccionar lo que esa comercializadora no admite en esa zona para ese segmento**. Es la misma información, pero una versión evita el error y la otra lo documenta después.

---

## Lo que NO haría

- **No replicar sus 38.448 productos como objetivo.** Ese número es consecuencia de su modelo de comisión escalonada por tramos, no una virtud. Tú ya tienes planes de comisión versionados, que es un modelo mejor. Copiar el volumen sería copiar su deuda.
- **No copiar sus 18 tipos de incidencia de golpe.** Su taxonomía es buena como *catálogo de lo que ocurre en la operación real* — úsala como checklist de cobertura, no como esquema a implementar.
- **No tocar el modelo de autoridad recién endurecido** para meter carterización dentro de `profiles`. Es otro agregado; merece sus propias tablas con el mismo patrón.
- **No abrir una segunda arquitectura.** Con 95 tablas, lo que mata no es la falta de funcionalidad, es la divergencia.

---

## Resumen en una frase

Zinergia no necesita alcanzar a Energilandia en dominio — ya la supera en fiscalidad, privacidad y conciliación. Necesita **cerrar tres huecos concretos** (SSA por corrección, gas por mercado, carterización por conflicto interno) y, sobre todo, **que el proceso de entrega deje de ir por detrás de la superficie que produce**.

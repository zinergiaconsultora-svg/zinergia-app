# Carterización — propiedad de cartera gobernada

**Autor:** Claude (Opus 5) · **Fecha:** 2026-08-04
**Origen:** Fase 3 de `claude-propuesta-desarrollo.md`, derivada del análisis competitivo de Energilandia.

---

## El problema

`clients.owner_id` (y `franchise_id`) **ya existían**: la propiedad del cliente estaba modelada. Lo que no existía era el **gobierno**.

Cualquier escritor con acceso a la tabla podía mover un cliente entre agentes, en silencio, sin dejar constancia de quién lo hizo ni por qué. Y como `owner_id` alimenta la atribución de comisión, eso no es una disputa de CRM: **es una disputa de dinero**.

Energilandia lo trata como proceso formal — tiene dos tipos de petición dedicados (`SOLICITUD ASIGNACIÓN CARTERA COMERCIAL`, `SOLICITUD TRASPASO CARTERA COMERCIAL`) y una columna `Tipo contrato` que marca `NO CARTERIZADO`. Con una red de franquicias y agentes, la pregunta *"¿de quién es este cliente?"* aparece sola; sin respuesta en el sistema se resuelve discutiendo.

---

## Decisión de diseño: reutilizar el molde, no inventar otro

El problema es **el mismo** que ZIN-SDD-041 resolvió para la autoridad de perfiles: un campo pequeño, disputado y adyacente al dinero, que necesita versión optimista, comando específico y evidencia inmutable.

Así que se aplica el mismo patrón, pieza por pieza:

| ZIN-SDD-041 (autoridad) | Aquí (carterización) |
|---|---|
| `profiles.authority_version` | `clients.ownership_version` |
| `profile_authority_events` | `client_ownership_events` |
| `private.profile_authority_guard()` | `private.client_ownership_guard()` |
| `change_profile_authority(...)` | `transfer_client_ownership(...)` |
| Contexto por `set_config` verificado en trigger | Idéntico |
| Idempotencia por `request_id` | Idéntica |

**No se abrió una segunda arquitectura.** Con ~95 tablas, la divergencia hace más daño que la falta de funcionalidad.

---

## Slice 1 — traspaso gobernado

`supabase/migrations/20260804050000_client_portfolio_ownership.sql`

**Reglas:**

- **Un agente no puede mover sus propios clientes.** Es exactamente el conflicto que esto previene. `transfer_client_ownership` sólo admite actor `admin` o `franchise`.
- **Franquicia** mueve dentro de su red, y sólo hacia miembros de su red.
- **Admin** puede mover entre franquicias, y **el cliente sigue al nuevo propietario** (`franchise_id` se actualiza al del destinatario), así que un cliente nunca queda en una franquicia a la que su dueño no pertenece.
- La franquicia de destino debe estar **activa**.
- **Versión optimista**: dos responsables no pueden consumir la misma versión esperada; el segundo recibe `OWNERSHIP_STALE_VERSION`.
- **Idempotencia por `request_id`**; reutilizarlo con otra intención es `OWNERSHIP_REQUEST_CONFLICT`, no un segundo traspaso silencioso.
- **Bloqueo advisory global** que serializa los traspasos concurrentes del mismo cliente.

**Garantías estructurales:**

- El guard exige contexto y **aplica también a `service_role`** — los triggers no se saltan por rol.
- Subir `ownership_version` sin mover al cliente se rechaza (`OWNERSHIP_VERSION_PROTECTED`): si no, cualquiera podría invalidar la lectura optimista de otro.
- `client_ownership_events` es **append-only** por trigger, incluido `TRUNCATE`. Una evidencia editable a posteriori no prueba nada.

---

## Slice 2 — solicitud y aprobación

`supabase/migrations/20260804060000_client_ownership_transfer_requests.sql`

El slice 1 dejó a los agentes sin ninguna vía. Eso era un hueco real: un agente que legítimamente necesita mover un cliente —traspaso, baja, cliente asignado a quien no era— no tenía camino, así que el asunto volvería a resolverse por WhatsApp y a aplicarlo quien tuviera acceso a la base de datos.

Esto añade la vía **sin debilitar la regla**: el agente pide, franquicia o admin decide, y la aprobación ejecuta el mismo traspaso gobernado.

- **Sólo el propietario actual** puede pedir que muevan su cliente. Una petición de otro sería una reclamación sobre cartera ajena — un flujo distinto y más conflictivo.
- **Un único pendiente por cliente** (índice único parcial), para que dos agentes no tengan una reclamación viva simultánea.
- **El solicitante no puede aprobar su propia solicitud**, aunque después gane el rol.
- **La aprobación revalida**: si la propiedad cambió entre la petición y la decisión, salta `TRANSFER_DECISION_STALE` en vez de traspasar a ciegas.
- **El aprobador es el actor del traspaso**, así que el comando reverifica su ámbito bajo su propio rol. Pasar por una solicitud **no concede privilegio**.
- Cross-franquicia sigue siendo decisión de admin; un agente no puede originarla.
- El solicitante puede cancelar su propia solicitud pendiente.

`CHECK` de forma: una solicitud resuelta debe llevar quién decidió y cuándo; una pendiente no puede llevarlos. Una aprobada debe apuntar a su evento de traspaso.

---

## Aplicación

`src/app/actions/clientOwnership.ts` — cuatro acciones (`transfer`, `request`, `decide`, `cancel`) más el historial. Todas devuelven resultado discriminado en vez de lanzar, porque el consumidor es un formulario y un error de server action llegaría como un digest opaco.

**Los mensajes se mapean desde códigos estables**, y lo que no se reconoce colapsa al genérico — un error inesperado de base de datos no puede filtrar estructura al navegador. Hay test que lo fija con `permission denied for relation clients_secret_backup`.

---

## Verificación

| Gate | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 |
| Tests de carterización | ✅ **26 pasados** |

Cobertura: autorización por rol, reenvío de versión optimista e idempotencia, generación de `request_id` cuando falta, réplica idempotente, entrada inválida rechazada sin tocar la base de datos, mensajes accionables para versión obsoleta y autoaprobación, y no filtración de errores no mapeados.

---

## Fuera de alcance, deliberadamente

- **Reclamación sobre cartera ajena** (un agente reclama un cliente que es de otro). Es el caso más conflictivo y merece su propio diseño, probablemente con arbitraje de admin.
- **UI.** No hay pantalla; las acciones están listas para conectarse.
- **Notificaciones** al solicitante y al aprobador.
- **Carterización a nivel de suministro**, no de cliente. Energilandia marca `NO CARTERIZADO` en el contrato, lo que sugiere que ellos lo tratan con más granularidad. Si aparece la necesidad, el mismo molde se aplica a `supply_points`.

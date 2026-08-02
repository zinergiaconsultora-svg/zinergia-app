# CRM Core Flow Simplification Requirements

Status: approved on 2026-07-30.

## Intent

Convertir Zinergia en un CRM operativo y sencillo para consultorias energeticas. El producto debe guiar al comercial desde la factura recibida hasta la activacion del contrato, la renovacion, la comision y su facturacion, sin obligarle a coordinar manualmente pantallas o estados duplicados.

La unidad profesional de seguimiento sera la `oportunidad`: un proceso comercial concreto, asociado a un cliente y a un punto de suministro, con responsable, etapa, proxima accion e historial. La factura es un documento de entrada; el cliente es la relacion; la oportunidad es el trabajo que debe avanzar.

## Current Audit Findings

- La entrada real del flujo, subir una factura, esta dentro de `Simulador` y no en `Facturas` ni en una accion global.
- La pantalla `Facturas` solo consulta filas con `has_proposal = true`, por lo que oculta facturas subidas que aun no tienen propuesta.
- El mismo negocio se representa con estados distintos en `clients`, `ocr_jobs`, `proposals`, `proposals_alta` y `contracts`.
- Una factura OCR se usa tambien como lead operativo. Varias facturas del mismo cliente pueden producir varios leads para una unica oportunidad comercial.
- La aceptacion intenta crear comision, cierre, tareas y contrato, pero varios efectos son no bloqueantes y pueden dejar un expediente parcialmente actualizado sin una cola de recuperacion visible.
- La permanencia se calcula con ventanas de 30, 60 y 90 dias segun el modulo. El flujo administrativo aprobado usa 60 dias, pero el CRM de clientes sigue usando 90.
- Existe `supply_points`, pero propuestas y contratos siguen asociados principalmente al cliente. Esto dificulta controlar profesionalmente varios CUPS del mismo titular.
- Los contratos tambien se modifican directamente desde el navegador mediante `contractsService`, con errores silenciosos y sin una accion de servidor auditada.
- `Cartera`, comisiones y facturacion se presentan como conceptos separados aunque forman un unico ciclo economico.
- La navegacion principal expone funciones secundarias antes que las colas de trabajo que necesita cada perfil.

## Scope

In scope:

- Un recorrido principal desde factura OCR hasta cliente activo.
- Una ficha unica de cliente con multiples puntos de suministro y oportunidades historicas.
- Una oportunidad comercial explicita para cada alta, cambio o renovacion.
- Propietario comercial visible y protegido en todo el ciclo.
- OCR, revision humana, comparacion, propuesta, aceptacion, alta, contrato, permanencia y renovacion.
- Comision trazable desde la propuesta aceptada hasta su facturacion y pago.
- Vistas de trabajo separadas para Comercial y Admin.
- Simplificacion de navegacion y terminologia.
- Reconciliacion y alertas para operaciones aceptadas que queden incompletas.
- RLS, auditoria y proteccion de PII en todo el flujo.

Out of scope for this phase:

- Gamificacion, puntos, rankings, academia y objetivos.
- Comparacion multiple y auditoria energetica avanzada.
- SIPS avanzado, recomendaciones predictivas y scoring comercial.
- Google Drive como superficie de usuario, salvo el archivado tecnico ya existente.
- Analitica avanzada, mapas, campañas y automatizaciones no necesarias para cerrar una operacion.
- Rediseño completo de tarifas o del motor matematico de comparacion.
- Gestion contable completa, impuestos avanzados o integracion con software contable externo.
- Cambiar las reglas economicas de reparto de comisiones ya aprobadas.

## Canonical Business Flow

`Cliente/Contacto -> Punto de suministro -> Oportunidad -> Factura/OCR -> Propuesta -> Alta -> Contrato -> Comision -> Facturacion`

Lifecycle de una oportunidad:

`Factura recibida -> Revision de datos -> Preparacion de propuesta -> Propuesta enviada -> Aceptada -> Alta en curso -> Ganada/Contrato activo`

Una renovacion no reabre ni sobrescribe la operacion historica: crea una nueva oportunidad de tipo `renewal` vinculada al contrato que vence.

The user-facing stages shall be:

1. `Factura pendiente`
2. `Revisar datos`
3. `Preparar propuesta`
4. `Esperando respuesta`
5. `Alta en curso`
6. `Cliente activo`
7. `Renovacion`
8. `Perdido`

Internal technical states may remain where required, but every oportunidad abierta shall have exactly one user-facing stage, one accountable owner and one explicit next action.

## Requirements

[REQ-001] WHEN a commercial user starts work, the system shall show a single primary action named `Nueva factura` and operational queues ordered by the next action required.

Verification:

- The commercial can start an OCR upload from the main navigation or dashboard in one action.
- The dashboard shows pending review, pending proposal, awaiting response, activation and renewal work.

[REQ-002] WHEN a valid invoice is uploaded, the system shall create or resolve the client/contact, resolve the supply point by protected CUPS hash, create or reuse the appropriate open opportunity, attach the OCR job to it, and preserve the commercial owner.

Verification:

- Uploading another invoice for the same CUPS does not create a duplicate client, supply point or simultaneous opportunity for the same commercial cycle.
- The invoice appears immediately in the commercial's work queue, including processing and failure states.

[REQ-003] WHILE OCR data has not been confirmed by a commercial, the system shall keep the opportunity in `Revisar datos` and shall not present it as ready to send.

Verification:

- A completed OCR job remains actionable until its critical fields are confirmed.
- OCR errors have a visible retry or manual-resolution action.

[REQ-004] WHEN OCR data is confirmed, the system shall make tariff comparison and proposal preparation the next action inside the same opportunity.

Verification:

- The user does not need to search for the same person in another top-level screen.
- The proposal retains links to its client, supply point and source OCR job.

[REQ-005] WHEN a proposal is sent, the system shall move the opportunity to `Esperando respuesta`, record the send date, keep the public acceptance link safe, and surface overdue follow-up as the next action.

Verification:

- Draft, sent, accepted, rejected and expired proposal states map deterministically to the canonical stage.
- Follow-up does not create duplicate tasks for the same proposal and milestone.

[REQ-006] WHEN a proposal is accepted, the system shall durably register the acceptance, advance the same opportunity and guarantee recoverable creation of the associated commission, activation expediente and pending contract.

Verification:

- Repeating or racing the acceptance produces one commission, one activation expediente and one contract per accepted proposal.
- If a dependent step fails, the accepted proposal remains accepted and a visible reconciliation item is created until the missing step succeeds.
- The owner used for commission, contract and notifications is the proposal owner, not the admin or franchise actor.

[REQ-007] WHILE an accepted operation is not activated, the system shall show `Alta en curso` and the exact missing requirement or administrative action.

Verification:

- The commercial and admin see the same activation progress with role-appropriate actions.
- A proposal is not shown as `Cliente activo` merely because it was signed.

[REQ-008] WHEN activation is confirmed, the system shall mark the contract active and require either a known end/permanence date or an explicit `Sin permanencia / fecha desconocida` value.

Verification:

- An active contract has a clear marketer, tariff, start date, supply point and permanence state.
- Contract writes use authorized server actions and create audit entries.

[REQ-009] WHEN an active contract reaches 60 days before its end date, the system shall create exactly one renewal opportunity and one actionable alert for its owner.

Verification:

- All commercial and admin surfaces use the same 60-day threshold.
- The completed original opportunity remains immutable as historical business.
- Dismissal or completion is audited and duplicate renewal opportunities or alerts are not created.

[REQ-010] WHEN a lead is lost, the system shall require a reason, keep the history and source invoice, remove it from active work, and allow authorized reopening without deleting the contact.

Verification:

- Won and lost are mutually exclusive.
- Reopening restores the last valid open stage from opportunity history and creates a new audited transition.

[REQ-011] WHEN users view a person or company, the system shall present one client record with summary, contact details, supply points, current and historical opportunities, documents, proposals, contracts, activity and commission linkage.

Verification:

- The user can understand each open opportunity's stage, owner and next action without opening another top-level module.
- Multiple invoices and supply points are grouped under the same client/contact.

[REQ-012] WHEN a commission is generated from an accepted proposal, the system shall show the lifecycle `Pendiente`, `Elegible`, `Validada`, `Facturada`, `Pagada` or `Revertida`, with immutable links to opportunity, proposal, client, commercial and fiscal invoice.

Verification:

- No commission can be invoiced twice.
- Commercial users see their amounts; admin sees all and can validate them.
- Monetary transitions are audited and idempotent.

[REQ-013] WHEN validated commissions are selected for billing, the system shall generate a fiscal invoice draft, prevent duplicate inclusion, and synchronize commission state when the invoice is issued, cancelled or paid.

Verification:

- Cancelling a draft/issued invoice returns eligible commissions to the correct billable state.
- Paying an invoice marks its linked commissions paid exactly once.

[REQ-014] WHILE a user has role `agent`, the system shall restrict records to their assigned portfolio; WHILE a user has role `admin`, the system shall provide global queues and filters by commercial and stage.

Verification:

- RLS and server authorization tests cover clients, supply points, OCR jobs, proposals, contracts, commissions and fiscal invoices.
- Reassigning an owner is admin-only and audited.

[REQ-015] WHEN the simplified experience is released, primary navigation shall expose only the essential daily workflow for each role.

Verification:

- Commercial primary navigation: `Trabajo`, `Clientes`, `Comisiones`, `Ajustes`, plus persistent `Nueva factura`.
- Admin primary navigation: `Operaciones`, `Clientes`, `Comisiones`, `Facturacion`, `Equipo`, `Administracion`.
- Secondary or out-of-scope features are removed from primary navigation without deleting data.

[REQ-016] IF any transition leaves related business records inconsistent, THEN the system shall expose a non-PII reconciliation queue and support safe retry.

Verification:

- Checks detect accepted proposals without commission, activation expediente or contract.
- Checks detect active contracts without a valid permanence state.
- Checks detect invoiced commissions without a fiscal invoice link.

[REQ-017] WHEN an opportunity changes stage, owner, outcome or next action, the system shall persist the transition through an authorized server workflow and append an immutable history event.

Verification:

- Direct browser writes cannot bypass the opportunity state machine.
- History records previous stage, new stage, actor, timestamp and safe reason metadata.
- Stage age can be calculated without inferring it from unrelated table timestamps.

[REQ-018] WHILE an opportunity is open, the system shall require an accountable owner and expose one next action with an optional due date.

Verification:

- Daily work queues can group opportunities into `Vencido`, `Hoy`, `Proximos` and `Sin fecha`.
- Supervisor/admin views can filter by owner, stage, type and stage age.
- An opportunity without a next action is visible as an operational exception.

[REQ-019] WHEN the same client has multiple supply points or successive commercial cycles, the system shall preserve each opportunity independently and prevent cross-linking documents or economic records.

Verification:

- A proposal, activation, contract and commission belong to one opportunity.
- A renewal creates a new opportunity linked to the prior contract.
- Closing one opportunity does not change another opportunity for the same client.

[REQ-020] WHEN a commission progresses economically, the system shall distinguish commercial acceptance, activation eligibility, administrative validation, fiscal invoicing and payment.

Verification:

- Acceptance creates a pending accrual.
- Activation makes the accrual eligible for validation; it does not silently mark it paid or invoiced.
- Cancellation, rejection or reversal preserves an audited monetary history.
- An admin can create a new effective-dated version of either economic channel from the commission management screen.
- Saving a new version closes the previous version and moves current assignments forward atomically; commissions already accepted keep their frozen percentages and amounts.

[REQ-021] WHEN Zinergia receives documented evidence that a contract ended before a known permanence end date, the system shall calculate an auditable proportional decommission proposal without rewriting the original commission or payment.

Verification:

- The proportional reversal is calculated server-side as `remaining calendar days / total permanence calendar days`, using the canonical contract start date, permanence end date and documented termination date.
- The commission and adjustment snapshots record the original allocation, contract dates, termination date, total days, remaining days, calculated percentage and evidence reference used by the operation.
- The system distinguishes a customer contract penalty from the commercial decommission owed between marketer, Zinergia, franchise and commercial.
- No monetary reversal occurs when permanence is absent, unknown or already fulfilled, nor without authoritative evidence and admin confirmation; incomplete cases enter an admin review queue.
- A confirmed full or partial reversal preserves the original allocation and creates negative ledger movements for every affected beneficiary.
- Paid or invoiced commissions use a future settlement adjustment and, when required, a linked rectifying fiscal document instead of deleting or editing historical documents.
- Commercial users can see the cause, dates, calculation, evidence state and dispute status of every adjustment affecting them.

[REQ-022] WHEN Zinergia calculates a commission, the system shall snapshot one balanced economic allocation from the marketer gross commission to the accountable commercial, franchise and Zinergia central, and shall keep supplier settlement separate from collaborator fiscal invoicing.

Verification:

- The proposal owner at acceptance is the immutable economic beneficiary; later operational reassignment does not move historical commission rights.
- A commercial has one explicit admin-assigned economic channel independent from the authentication role: `partner_direct` or `franchise_network`.
- The five current Zinergia partners start on the `partner_direct` plan, with a higher commercial percentage, no franchise allocation and a smaller Zinergia central percentage; neither the count nor user identifiers are hardcoded in calculation code.
- A franchise-network commercial receives a lower percentage of the marketer gross commission and Zinergia retains a higher percentage; an optional franchise allocation is explicit rather than hidden inside either amount.
- No commercial or franchise can assign or change its own economic plan.
- Gross supplier commission equals the sum of commercial, franchise and central allocations, subject only to explicit rounding rules.
- Historical calculation snapshots remain unchanged when tariff, global split or franchise royalty configuration changes.
- Supplier statements, commercial invoices and uploaded customer energy bills are distinct document types and cannot settle one another.
- Self-billing is available only when a prior agreement and per-document acceptance workflow are recorded; otherwise the commercial uploads or issues the fiscal invoice.

## Properties / Invariants

- [INV-001] One uploaded invoice is a document, not an independent client or a won lead.
- [INV-002] A client/contact may have many supply points and opportunities, but every opportunity has one accountable commercial owner.
- [INV-003] Every open opportunity has one canonical stage and one next action; its stage is not independently derived by UI components.
- [INV-004] Proposal acceptance, commission creation, activation and contract creation are idempotent and recoverable.
- [INV-005] A lead becomes a user-facing active client only after activation is confirmed.
- [INV-006] One accepted proposal creates at most one commission and one contract.
- [INV-007] One commission belongs to at most one fiscal invoice at a time.
- [INV-008] All permanence and renewal decisions use one canonical 60-day threshold.
- [INV-009] CUPS and DNI remain encrypted with blind indexes; no PII appears in logs, client-facing errors or reconciliation metadata.
- [INV-010] All schema changes use versioned Supabase migrations and regenerated database types.
- [INV-011] All mutating operations authorize on the server before writing; RLS remains defense in depth.
- [INV-012] Out-of-scope modules shall not block or complicate the core workflow.
- [INV-013] A completed opportunity is historical and immutable except for audited administrative correction.
- [INV-014] A renewal is a new opportunity, never a mutation of the opportunity that originally won the contract.
- [INV-015] Documents, proposals, contracts, commissions and fiscal invoice lines cannot be associated across opportunities.
- [INV-016] Paid and invoiced monetary events are immutable; corrections are append-only positive or negative ledger entries.
- [INV-017] No decommission is posted without a canonical contract, known start and permanence end dates, a documented early termination date and evidence.
- [INV-018] The reversal percentage is derived server-side from frozen contract dates and cannot be supplied by the caller; every allocation remains balanced to its gross supplier amount.
- [INV-019] Customer early-termination penalties and collaborator decomissions are independent facts with independent amounts and evidence.
- [INV-020] One commission allocation can belong to at most one active collaborator fiscal-invoice line or settlement line.
- [INV-021] Economic channel and plan assignment is explicit, versioned and admin-controlled; it is never inferred only from `role`, missing `franchise_id` or current ownership.

## Success Criteria

- A commercial can process a new invoice through proposal send without leaving the opportunity workspace.
- An admin can identify every operation needing attention from one queue.
- A proposal acceptance cannot disappear into a partially completed state without an alert.
- Every active client shows contract status and permanence clearly.
- Every commission can be traced to an accepted proposal and, when applicable, to a fiscal invoice.
- The primary navigation contains no feature that is not required for the core workflow.
- Management can measure pipeline, stage age, overdue next actions and conversion without reconstructing the process from document timestamps.

## Approved Product Decisions

- The canonical commercial process is an explicit opportunity linked to one client and one supply point.
- Renewals create new opportunities and preserve the completed historical operation.
- `Cliente activo` begins only when activation is confirmed, not when the proposal is merely accepted.
- Activation confirmation remains admin-only; the commercial sees progress and missing requirements.
- Fiscal invoices continue to be issued by the commercial/profile to Zinergia under the current model.
- Franchise remains supported as a supervisor role, but it does not add steps to the commercial's core workflow.

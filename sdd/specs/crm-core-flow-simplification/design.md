# CRM Core Flow Simplification Design

Status: approved on 2026-07-30.

## Product Decision

Zinergia will use a professional CRM model while keeping the daily interface deliberately simple:

`Cliente/Contacto -> Punto de suministro -> Oportunidad -> Documentos/Propuestas -> Contrato -> Comision`

The opportunity is the canonical commercial process. It owns the stage, responsible commercial, next action, due date and stage history. The client remains the long-lived relationship; the supply point identifies the energy service; invoices are source documents; contracts and commissions are outcomes.

This corrects a weakness in the earlier design. Deriving a commercial stage from the latest invoice, proposal and contract is ambiguous when one client has several CUPS, invoices or renewals. An explicit opportunity preserves each deal and its history without making the UI more complicated.

## Experience Strategy

The selected visual direction combines:

- `Expediente guiado` on desktop: work queue on the left and the selected opportunity on the right.
- `Campo movil primero` on small screens: one clear next action, compact metadata and no dense dashboard.
- A table view only as an optional admin/supervisor mode for bulk review.

The product behaves as a work system, not a collection of feature pages. Each screen answers:

- What needs attention?
- Who owns it?
- What stage is it in?
- What is the next action?
- When is it due?

## Roles

### Commercial

Primary navigation:

- `Trabajo`
- `Clientes`
- `Comisiones`
- `Ajustes`
- Persistent primary action: `Nueva factura`

The commercial sees only assigned opportunities and portfolio records.

### Admin

Primary navigation:

- `Operaciones`
- `Clientes`
- `Comisiones`
- `Facturacion`
- `Equipo`
- `Administracion`

The admin confirms activation, validates commissions, manages fiscal invoicing and resolves operational exceptions.

### Franchise

Uses the same operational concepts with supervisor visibility limited to its network. It does not introduce another step into the commercial flow.

## Terminology

To avoid the current ambiguity:

- Uploaded electricity/gas bills are `Facturas de consumo` or `Documentos`.
- Tax invoices issued for commissions are `Facturacion de comisiones`.
- `Lead` is a lifecycle label for a client without a won opportunity.
- `Oportunidad` is the concrete sale, switch or renewal being worked.
- `Cliente activo` means at least one activation has been confirmed and its contract is active.

## Core Screens

### 1. Trabajo / Operaciones

This is the default screen.

Desktop uses a split view:

- Left: compact work queue.
- Right: selected opportunity summary and current action.

Mobile uses a single-column list and opens the opportunity as a full page.

Queue groups:

- `Vencido`
- `Hoy`
- `Proximos`
- `Sin fecha`

Optional filters:

- Stage
- Owner
- Opportunity type
- Stage age
- Franchise for authorized users

Each row shows:

- Client name.
- Supply point label.
- Opportunity type.
- Stage.
- Stage age or due date.
- Owner when permitted.
- One primary next action.

Top summary is limited to three operational values:

- `Necesitan accion`
- `Esperando cliente`
- `Renovaciones`

Pipeline/table views are secondary tabs. Decorative charts, gamification and large metric cards do not precede the queue.

### 2. Nueva factura

The default flow is:

1. Upload invoice.
2. OCR processing with visible recoverable status.
3. Confirm critical extracted fields.
4. Resolve client and supply point.
5. Create or reuse the correct open opportunity.
6. Compare tariffs.
7. Prepare and send proposal.

The experience reuses the current PDF/OCR/comparison capabilities, but moves batch upload, presentation mode and advanced analysis behind `Mas opciones`.

The flow header always shows client, supply point, opportunity stage and persistence status.

### 3. Opportunity Workspace

This is the focused operational view.

Header:

- Client and supply point.
- Opportunity type.
- Stage and stage age.
- Owner.
- Next action and due date.
- One primary action.

Sections:

- `Resumen`: current action, relevant contact and supply data.
- `Documentos`: source bills and OCR confirmation.
- `Propuestas`: draft, sent, accepted, rejected or expired.
- `Alta y contrato`: requirements, activation and resulting contract.
- `Economia`: linked commission and fiscal invoice state.
- `Actividad`: notes, contacts and immutable stage history.

Exceptional actions such as losing, reassigning or correcting are in an overflow menu and require confirmation/reason.

### 4. Clientes

The client page is the relationship record, not the deal itself.

Portfolio columns:

- Client/contact.
- Open opportunities.
- Active supply points.
- Owner.
- Current contract/marketer.
- Nearest permanence date.
- Next action.
- Last contact.

Client detail contains:

- Contact and privacy-safe identity data.
- Supply points.
- Open opportunities.
- Historical won/lost opportunities.
- Active and previous contracts.
- Documents and activity.

### 5. Comisiones

Lifecycle:

1. `Pendiente`: created from accepted proposal.
2. `Elegible`: activation confirmed.
3. `Validada`: admin has confirmed economic eligibility.
4. `Facturada`: included in an issued fiscal invoice.
5. `Pagada`: linked fiscal invoice paid.
6. `Revertida`: cancelled/rejected with audited reason.

Every commission links immutably to opportunity, proposal, client, owner and fiscal invoice line when applicable.

#### Zinergia economic allocation

The canonical economic direction is:

1. The marketer owes a gross supplier commission to Zinergia for a validated supply contract.
2. Zinergia selects the explicit economic plan assigned to the proposal owner at acceptance.
3. The plan allocates the gross amount among commercial, optional franchise and Zinergia central.
4. The allocation is frozen with the operation and never follows a later owner or plan change.

Zinergia has two canonical economic channels:

| Channel | Commercial allocation | Franchise allocation | Zinergia central allocation |
|---|---|---|---|
| `partner_direct` | High percentage for an approved Zinergia partner | Always zero | Remaining smaller percentage |
| `franchise_network` | Lower percentage for the franchise commercial | Explicit configurable percentage, possibly zero | Remaining higher percentage |

The initial five partners are assignments in business data, not five special users in application code. `commission_plan_assignments` records who belongs to each channel, effective dates, assigning admin and reason. Authentication roles continue to control permissions; the economic channel controls only calculation and settlement. A user cannot assign or modify their own plan.

Each versioned `commission_plan` defines commercial, franchise and central percentages that sum to exactly 100%. Percentages are configurable by effective date and may optionally be specialized by marketer, product or campaign without changing historical operations.

The admin commission screen is the only primary editing surface for these percentages. Creating a new version is atomic: it closes the prior version, creates the successor and rolls every current assignment for that channel forward at the same effective timestamp. Existing commissions are never recalculated because their accepted allocation snapshot remains immutable.

Each accepted proposal stores an immutable calculation snapshot containing:

- Gross supplier commission and source (`tariff_fixed`, supplier statement or approved savings rule).
- Economic channel, plan and assignment versions.
- Commercial percentage and net amount.
- Franchise percentage and amount, always zero for `partner_direct`.
- Zinergia central amount.
- Global rule, tariff/catalog and franchise-royalty versions.
- Original owner, franchise, marketer, product/campaign and rounding result.

The three final allocations must equal the supplier gross commission. Historical amounts never recalculate when a tariff, owner, rule or royalty later changes. A renewal is a new opportunity and receives a new snapshot.

#### Decommission lifecycle

A decommission is a negative economic event linked to the original commission, not a destructive status edit. The canonical new-business rule is proportional unfulfilled permanence, not an editable table of arbitrary day bands.

The rule applies only when the commission is linked to a canonical contract with known start and permanence end dates and Zinergia has documented an actual termination before that end date. The protected database workflow derives `reversal_bps = round(remaining_days * 10000 / total_days)` from date-only calendar arithmetic, clamps only for monetary safety and applies that ratio to the frozen gross and beneficiary allocation. The caller cannot submit a percentage.

Legacy marketer/product policies and bands remain readable for operations that already froze them, but they are no longer the primary rule or editing surface for new commissions. Supplier corrections unrelated to permanence remain reviewable legacy adjustments and cannot masquerade as a permanence breach.

The protected workflow is:

1. An authorized admin records the documented early termination date and evidence reference against an eligible commission.
2. The service-only workflow locks and matches the canonical contract, original commission and frozen allocation without exposing CUPS plaintext.
3. Calculate the proposed partial reversal from total and remaining permanence days.
4. Reject absent, unknown, fulfilled or inconsistent permanence and require admin review of the resulting proposal.
5. Append negative allocation events using the original beneficiary proportions.
6. Offset unpaid amounts in the next settlement; never silently debit a different operation.
7. For already invoiced/paid amounts, create a linked adjustment balance and rectifying-document requirement.
8. Notify the commercial with reason, dates, amount, evidence state and dispute deadline.

Customer contract penalties are recorded separately and never used as the decommission amount. A known permanence end date alone cannot trigger a reversal.

#### Economic records

- `network_commissions` remains the compatible aggregate during rollout.
- `commission_plans` and `commission_plan_assignments` store versioned channel allocation and admin-controlled membership.
- `commission_decommission_policies` and immutable bands retain legacy frozen rules; new operations snapshot the canonical proportional-permanence rule.
- `commission_allocations` stores commercial, franchise and central amounts.
- `commission_events` is the append-only monetary/state ledger.
- `commission_adjustments` stores proposed, confirmed, waived and disputed decomissions.
- `supplier_statements` and `supplier_statement_lines` reconcile marketer credits/debits.
- `commission_settlements` and unique settlement lines group collaborator payables.

All mutation occurs through locking, service-only database workflows with explicit admin actors. Read models expose only portfolio-safe operational and economic fields.

### 6. Facturacion

This screen is explicitly `Facturacion de comisiones`.

Admin lifecycle:

- Draft.
- Issued.
- Paid.
- Cancelled.

A fiscal invoice selects validated commissions, prevents duplicate inclusion, records issuer/recipient and synchronizes commission states idempotently.

Zinergia distinguishes three document directions:

- Customer energy bills are OCR source documents and have no fiscal-settlement effect.
- Marketer settlement statements record incoming commission revenue and supplier decomissions.
- Collaborator fiscal invoices record the commercial or franchise service supplied to Zinergia.

By default, the commercial/franchise is the fiscal issuer and Zinergia is the recipient. Optional self-billing may let Zinergia prepare the document in the collaborator's name only when a prior agreement, document acceptance and dedicated numbering/series requirements are recorded. A reversal after invoicing creates a linked rectifying document or adjustment; the original invoice remains immutable.

## Opportunity Model

### `public.opportunities`

Proposed columns:

- `id uuid primary key`
- `client_id uuid not null`
- `supply_point_id uuid not null`
- `owner_id uuid not null`
- `franchise_id uuid null`
- `type text not null`: `new_business`, `switch`, `renewal`
- `stage text not null`
- `source text null`
- `stage_entered_at timestamptz not null`
- `next_action_type text null`
- `next_action_title text null`
- `next_action_due_at timestamptz null`
- `expected_close_date date null`
- `source_contract_id uuid null` for renewals
- `won_at timestamptz null`
- `lost_at timestamptz null`
- `loss_reason text null`
- `closed_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Canonical stages:

1. `invoice_received`
2. `data_review`
3. `proposal_preparation`
4. `proposal_sent`
5. `accepted`
6. `activation`
7. `won`
8. `lost`

`renewal` is an opportunity type and a queue classification, not a mutation of a completed opportunity. A renewal opportunity follows the same stages.

### `public.opportunity_stage_history`

Append-only fields:

- `id`
- `opportunity_id`
- `from_stage`
- `to_stage`
- `actor_id`
- `reason_code`
- `safe_metadata jsonb`
- `created_at`

No PII, public tokens or signature data are allowed in `safe_metadata`.

### Relationships

Add nullable `opportunity_id` during migration to:

- `ocr_jobs`
- `proposals`
- `proposals_alta`
- `contracts`
- `network_commissions`
- `tasks`

Add/retain `supply_point_id` where required on OCR jobs, proposals and contracts.

Enforce:

- One accepted proposal creates at most one contract.
- One proposal creates at most one commission.
- One commission belongs to at most one active fiscal invoice line.
- One open renewal opportunity per source contract.
- Business records linked to an opportunity must match its client, supply point and owner boundaries.

## State Machine

Only authorized server workflows change stage.

| Event | From | To | Default next action |
|---|---|---|---|
| Invoice uploaded | new | invoice_received | Wait/retry OCR |
| OCR completed | invoice_received | data_review | Review invoice |
| Critical data confirmed | data_review | proposal_preparation | Compare tariffs |
| Proposal sent | proposal_preparation | proposal_sent | Follow up |
| Proposal accepted | proposal_sent | accepted | Complete activation |
| Activation opened | accepted | activation | Resolve missing requirements |
| Activation confirmed | activation | won | Monitor contract |
| Opportunity lost | any open stage | lost | None |

Every transition:

1. Authorizes role and portfolio.
2. Locks or conditionally updates the current opportunity.
3. Validates allowed transition and required data.
4. Writes the new stage and `stage_entered_at`.
5. Appends stage history.
6. Computes the next action.
7. Creates/reconciles dependent records idempotently.

The browser never writes stage directly.

## Renewals

At 60 days before a known contract end:

1. A protected scheduled workflow checks eligible active contracts.
2. It creates one `renewal` opportunity using `source_contract_id`.
3. It assigns the current accountable owner.
4. It sets `proposal_preparation` or `data_review` depending on document freshness.
5. It creates one next action and one safe audit event.

Unknown or absent permanence is explicit. These contracts appear in a data-quality queue, not in a fabricated renewal date.

## Acceptance Integrity

Proposal acceptance is durable even if a dependent service fails.

Required effects:

- Opportunity advances to `accepted` and then `activation`.
- One pending commission accrual exists.
- One activation record exists.
- One pending contract exists.

`proposal_acceptance_integrity` detects missing effects. Admin sees a non-PII reconciliation queue and can retry only the missing effects. Notification failure never rolls back business state.

## Data Migration

A versioned Supabase migration will:

1. Create `opportunities`.
2. Create append-only `opportunity_stage_history`.
3. Add opportunity/supply-point foreign keys to existing records.
4. Add OCR confirmation fields.
5. Add explicit contract permanence state: `known`, `none`, `unknown`.
6. Add indexes for owner queues, stage age, due actions and renewal lookup.
7. Add uniqueness for proposal/contract/commission and source-contract renewal invariants.
8. Create `crm_work_queue` and `proposal_acceptance_integrity` as `security_invoker = true` views.
9. Add RLS policies for agent, franchise and admin scopes.
10. Grant only required authenticated Data API access.

The migration is additive. New relationships remain nullable until backfill and application rollout are verified.

### Backfill

- Deterministically group existing records by client, protected supply point identity and commercial cycle.
- Create separate historical opportunities for clearly distinct accepted proposals/contracts.
- Never decrypt or compare raw CUPS in SQL.
- Never guess ambiguous ownership or supply relationships.
- Mark ambiguous legacy rows for admin reconciliation.
- Produce counts before and after backfill and an idempotent verification query.

## Service Architecture

### Read model

`src/lib/crm/workQueue.ts` returns stable opportunity work items from `crm_work_queue`.

```ts
interface OpportunityWorkItem {
    opportunityId: string;
    clientId: string;
    supplyPointId: string;
    ownerId: string;
    type: "new_business" | "switch" | "renewal";
    stage: CrmOpportunityStage;
    clientName: string;
    supplyLabel: string;
    stageEnteredAt: string;
    nextAction: CrmNextAction | null;
    nextActionDueAt: string | null;
}
```

### Write model

All mutations use server actions/services with `requireServerRole(...)`:

- `startOpportunityFromInvoiceAction`
- `confirmOcrDataAction`
- `sendOpportunityProposalAction`
- `recordOpportunityFollowUpAction`
- `markOpportunityLostAction`
- `reopenOpportunityAction`
- `confirmActivationAction`
- `updateContractAction`
- `validateCommissionAction`
- `generateFiscalInvoiceAction`
- `retryAcceptanceReconciliationAction`

The browser-side `contractsService` becomes read-only and is removed after call sites migrate.

## Visual System

Operational UI:

- White/slate neutral surfaces.
- Deep blue for the primary action/current navigation.
- Emerald only for active/paid success.
- Amber only for deadlines/renewals.
- Red only for errors/lost/cancelled.
- Maximum 8px card radius.
- Flat page sections and compact rows; no cards nested inside cards.
- No gradient text, decorative gradients, glass navigation or gamification.
- Lucide icons with labels/tooltips.
- Fixed typography scale and stable control dimensions.
- 150-250ms feedback transitions with reduced-motion support.

## Loading, Empty and Error States

- Skeleton rows preserve queue dimensions.
- Empty queues explain the business condition and offer the relevant action.
- OCR failures expose retry/manual review without raw integration errors.
- Unsaved or failed transitions remain visible.
- Reconciliation shows only safe identifiers and missing effect types.
- No PII appears in logs, errors or audit metadata.

## Authorization and Privacy

- Agent: own portfolio and opportunities.
- Franchise: its network only.
- Admin: global operations and administrative transitions.
- Public client: token-scoped proposal read/acceptance only.

Controls:

- RLS on all exposed tables.
- `security_invoker = true` on views.
- Server authorization before every mutation.
- CUPS/DNI encryption and blind-index equality.
- Service role confined to `src/lib/supabase/service.ts`.
- Public acceptance retains rate limiting and signature validation.

## Rollout

### Slice 1: Opportunity foundation

- Add opportunity schema, history, RLS and backfill tooling.
- Create read-only work queue.
- Keep all existing routes operational.

### Slice 2: Daily work experience

- Simplify role navigation.
- Make `Trabajo/Operaciones` the default.
- Add persistent `Nueva factura`.
- Connect upload/OCR/proposal actions to opportunities.

### Slice 3: Opportunity workspace and integrity

- Build the focused workspace.
- Move contract writes to server actions.
- Add acceptance reconciliation and stage history.

### Slice 4: Renewal and economic lifecycle

- Create renewal opportunities at 60 days.
- Align commission states with activation, validation, invoicing and payment.
- Simplify fiscal invoicing.

### Slice 5: Consolidation

- Verify usage and E2E coverage.
- Remove obsolete primary navigation and duplicate write paths.
- Retain secondary routes only where they still provide necessary administration.

## Verification

Unit:

- Allowed/forbidden stage transitions.
- Next-action calculation.
- Stage age and overdue grouping.
- Renewal idempotency at 60 days.
- Commission/fiscal lifecycle.

Integration:

- Upload resolves client, supply point and opportunity.
- OCR confirmation advances the same opportunity.
- Acceptance creates/reconciles activation, contract and commission.
- Activation marks opportunity won and client active.
- Renewal creates a new opportunity without modifying historical business.
- Fiscal invoice transitions remain idempotent.

Authorization:

- Agent cannot view or mutate another portfolio.
- Franchise remains restricted to its network.
- Activation, reassignment and economic validation remain admin-only.
- Public proposal remains token/rate-limit/signature protected.

E2E:

- Commercial: upload -> OCR fixture -> review -> compare -> send.
- Public: accept valid proposal exactly once.
- Admin: activation -> contract active -> commission eligible.
- Renewal: expiring contract -> renewal opportunity.
- Economic: validate -> invoice -> paid.
- Desktop split view and mobile task flow.

Required gates:

- `node sdd/scripts/validate-sdd.mjs`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run test`
- `npm run build`
- Focused E2E with configured staging credentials.
- Supabase dry run, staging apply, schema verification and production promotion.

## Rollback

- Existing routes remain available until each slice is verified.
- New foreign keys are nullable during rollout.
- Navigation can revert without data rollback.
- New views can be removed without changing source records.
- Opportunity writes can be feature-flagged while legacy reads remain active.
- Additive schema is not dropped during emergency rollback; traffic returns to proven paths.

## Approved Design Decisions

- Introduce `opportunities` as the canonical commercial process.
- Preserve client as the long-lived account and supply point as the energy unit.
- Treat renewals as new opportunities linked to prior contracts.
- Use the desktop guided split view plus the mobile action-first pattern.
- Keep proposal acceptance durable and reconcile dependent records.
- Confirm `Cliente activo` only after admin activation.
- Preserve the fiscal direction: commercial/profile invoices Zinergia.
- Keep franchise as supervisor without adding workflow steps.

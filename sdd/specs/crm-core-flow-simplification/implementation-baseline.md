# CRM Core Flow Implementation Baseline

Status: captured locally on 2026-07-30. No remote queries or writes were performed.

## Purpose

This baseline maps the existing production-compatible schema and application write paths before introducing canonical opportunities. It is the preflight reference for Slice 1 and must be rechecked against staging immediately before applying the migration.

## Existing Domain Records

| Domain | Current source | Current state | Compatibility decision |
|---|---|---|---|
| Relationship | `public.clients` | `new`, `contacted`, `in_process`, `won`, `lost` | Keep as long-lived account/contact; do not use as the deal state after rollout. |
| Supply | `public.supply_points` | Multi-CUPS with ciphertext, blind hash and last four | Keep as supply identity; plaintext `cups` is constrained to `NULL`. |
| Source bill | `public.ocr_jobs` | `processing`, `completed`, `failed`, plus operational closure/loss fields | Keep as document/OCR process; link to opportunity and supply point. |
| Proposal | `public.proposals` | `draft`, `sent`, `accepted`, `rejected`, `expired` | Keep as offer and public acceptance record; link to opportunity and supply point. |
| Activation | `public.proposals` + `public.proposals_alta` view | `pendiente_consent`, `lista_admin`, `en_alta`, `activada`, `rechazada` | Do not create a second activation table. Expose opportunity through the proposal relation. |
| Activation audit | `public.proposal_alta_events` | Append-oriented event records | Preserve; opportunity history covers commercial stage, not detailed activation events. |
| Contract | `public.contracts` | `active`, `pending_switch`, `cancelled`, `expired` | Link to opportunity/supply point and add explicit permanence state. |
| Renewal legacy | `public.renewal_opportunities` | `open`, `contacted`, `proposal_sent`, `converted`, `dismissed` | Preserve during rollout. New professional renewals use `opportunities.type = 'renewal'`. |
| Tasks legacy | `public.tasks`, `public.next_actions` | Independent task/action states | Preserve and optionally link tasks to opportunities. Opportunity next action is canonical for the new work queue. |
| Commission | `public.network_commissions` | `pending`, `approved`, `cleared`, `paid`, `rejected` | Preserve calculations and existing values; normalize lifecycle in Slice 4. |
| Fiscal invoice | `public.invoices` | `draft`, `issued`, `paid`, `cancelled` | Preserve; distinguish from uploaded consumption bills in UI. |

## Existing Invariants

- `network_commissions.proposal_id` is already unique.
- `contracts.proposal_id` is indexed but is not unique.
- Public proposal acceptance is conditional/idempotent in application code and must remain rate-limited and signature-validated.
- `proposals_alta` is a `security_invoker = true` view, not a table.
- CUPS equality uses `cups_hash`; plaintext supply-point CUPS is prohibited.
- Existing role helpers are `public.is_superadmin()`, `public.is_admin()` and `public.get_my_franchise_id()`.
- Identity-dependent RLS policies were hardened to init-plan style calls.
- New opportunity/history writes must not be granted to browser-authenticated roles.

## Current Write Paths

Server actions:

- `src/app/actions/proposals.ts`: proposal create/update, OCR comparison timestamp, commission upsert, tasks and contract side effects.
- `src/app/actions/publicProposal.ts`: public acceptance and safe activities/notifications.
- `src/app/actions/alta.ts`: activation transitions and activation audit.
- `src/app/actions/clients.ts`: client/contact writes and activities.
- `src/app/actions/billing.ts`: fiscal invoice lifecycle and audit.
- `src/app/actions/energy.ts`: switch-event creation.

Browser/service paths to retire or constrain:

- `src/services/crm/contracts.ts`: direct insert/update/delete.
- `src/services/crm/proposals.ts`: direct insert/update/delete.
- `src/services/crm/tasks.ts`: direct insert/update/delete.
- `src/services/crm/clients.ts`: direct client insert/update/delete.

Slice 1 does not remove these paths. Slice 2-3 migrate the touched workflow to authorized server actions before browser writes are removed.

## Migration Compatibility Rules

- Create `public.opportunities`; do not rename or reuse `public.renewal_opportunities`.
- Add relationships as nullable until deterministic backfill is verified.
- Link activation through `proposals.opportunity_id`; do not add a column to the `proposals_alta` view as if it were a table.
- Use composite foreign keys to prevent client/supply-point or client/opportunity cross-linking.
- Keep legacy client/OCR statuses during rollout.
- Do not change commission status values in the foundation migration.
- Do not remove old routes, policies, functions or triggers in the foundation migration.
- Grant authenticated users RLS-gated read access only to opportunities/history. Writes use authorized server workflows.

## Staging Preflight

Run `supabase/scripts/verify_crm_opportunity_preflight.sql` immediately before migration apply. It is read-only and must return zero rows.

The script covers these checks:

```sql
select 'clients' as relation, count(*) from public.clients
union all select 'supply_points', count(*) from public.supply_points
union all select 'ocr_jobs', count(*) from public.ocr_jobs
union all select 'proposals', count(*) from public.proposals
union all select 'contracts', count(*) from public.contracts
union all select 'network_commissions', count(*) from public.network_commissions
union all select 'tasks', count(*) from public.tasks;

select proposal_id, count(*)
from public.contracts
where proposal_id is not null
group by proposal_id
having count(*) > 1;

select cups_hash, count(*)
from public.supply_points
where cups_hash is not null
group by cups_hash
having count(*) > 1;

select sp.id, sp.client_id
from public.supply_points sp
left join public.clients c on c.id = sp.client_id
where c.id is null;

select count(*) as plaintext_supply_points
from public.supply_points
where cups is not null;
```

Expected blockers:

- Any duplicate non-null `contracts.proposal_id`.
- Any duplicate non-null `supply_points.cups_hash`.
- Any orphan supply point.
- Any non-null plaintext `supply_points.cups`.

## Post-Migration Verification

Run `supabase/scripts/verify_crm_opportunity_foundation.sql`. It is read-only and must return zero rows.

```sql
select to_regclass('public.opportunities') as opportunities,
       to_regclass('public.opportunity_stage_history') as stage_history;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'ocr_jobs', 'proposals', 'contracts', 'network_commissions', 'tasks'
  )
  and column_name in (
    'opportunity_id', 'supply_point_id', 'confirmed_at',
    'confirmed_by', 'permanence_status'
  )
order by table_name, column_name;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('opportunities', 'opportunity_stage_history')
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('opportunities', 'opportunity_stage_history')
order by grantee, table_name, privilege_type;
```

Authenticated users must have `SELECT` only. Service role owns the write path. No backfill is part of the foundation migration.

## Rollback Point

Before application code writes opportunity IDs, rollback is:

1. Disable the feature flag/read path.
2. Drop newly added foreign keys and nullable columns.
3. Drop opportunity history, then opportunities.

After deterministic backfill or application writes begin, do not destructively roll back data. Return traffic to legacy routes and retain the additive schema until a reviewed corrective migration is available.

# ZIN-SDD-041 Profile Authority Preflight

Date: 2026-08-03  
Scope: T1 only — local repository and staging; database/catalog checks are read-only.  
Production: prohibited and not queried.

## Safety boundary

- Production ref: known only for refusal checks; the repository remains linked to production and no command used `--linked`.
- Approved staging ref: `dnzytocmtmnptndeczny` (`zinergia-staging`).
- Remote SQL uses an explicit staging pooler URL assembled in memory from `.env.staging.local`.
- The runner rejects production and unknown refs before any remote call.
- The SQL result contains catalog metadata and aggregate counts only. It returns no profile, invitation or Auth identifiers and no PII.
- The connection requests `default_transaction_read_only=on` and a 30-second statement timeout. The pooler reported both transaction settings as `off`, so safety ultimately rested on the staging-ref refusal guard and the reviewed SQL being one aggregate `SELECT`; this limitation is recorded rather than hidden.
- No migration, repair, schema write, data write or production request is part of this preflight.
- The effective JWT lifetime check created one normal staging E2E Agent session, decoded only its `iat`/`exp`, then revoked that local session. It changed no domain or authority data and emitted no token or identity.

## Environment and tooling evidence

| Check | Result |
|---|---|
| Repository linked ref | Production; therefore deliberately unused |
| Staging env | `.env.staging.local`; URL, anon key and DB password variables present |
| Local Supabase config | Auth signup enabled; email signup enabled; JWT expiry 3600 seconds |
| Supabase CLI | `2.111.0` |
| `db query --help` | Supports explicit `--db-url` and `--file` |
| `migration list --help` | Supports explicit `--db-url` |
| Staging Auth settings endpoint | Reachable; `disable_signup = false`, `mailer_autoconfirm = false`; JWT expiry not exposed by this public endpoint |
| Effective staging access-token lifetime | `3600` seconds, measured from a staging E2E Agent JWT `exp - iat`; token was not printed and the local session was revoked |
| Staging Postgres | Reachable through `aws-1-eu-central-1.pooler.supabase.com`; PostgreSQL `17.6` |
| Staging read-only enforcement | Requested at connection level, but the pooler reported `transaction_read_only = off` and `default_transaction_read_only = off`; the executed file was independently reviewed as one aggregate `SELECT` |

Blocking finding: public Auth signup is currently enabled in staging. This is expected pre-implementation evidence, but Slice 2/contract cannot pass until the controlled invitation provisioning flow is deployed and public signup is disabled and reverified.

The public settings endpoint does not expose configured JWT expiry. The issued staging E2E access token establishes an effective 3600-second lifetime for the supported password-login flow; do not substitute the similarly valued local config as remote evidence.

## Migration history

`npx supabase migration list --db-url <staging-read-only-url>` succeeded without changing link state. Local and staging histories match through `20260802110130`; no local-only or remote-only version was reported.

## Confirmed local security findings

- The versioned baseline grants `profiles.role` the default `agent` and defines `Users can update own profile` with only `auth.uid() = id`; it has no protected-column boundary.
- The current versioned `handle_new_user()` inserts `role = 'agent'` and updates email/full name on conflict. The later hardening migration changes its `search_path` and execution ACL but does not neutralize this role assignment.
- Local Auth configuration has general and email signup enabled and a 3600-second JWT lifetime. These values are local evidence only.
- Staging's public Auth settings independently confirm that signup is enabled and email is not auto-confirmed.

## Local writer inventory

| Current path | Classification | Required destination |
|---|---|---|
| `src/app/actions/profile.ts` | Own identity updates; company name is also copied into personal name | Exact four-field own-profile command; company data remains in `franchise_config` |
| `src/app/actions/admin.ts` | Direct service-role franchise assignment/removal and combined identity/authority update | Scoped name command plus one reasoned, versioned Admin authority command |
| `src/app/actions/network.ts` | Direct subordinate name/email update; role-only deactivate/reactivate; Auth deletion | Name-only scoped command; authority transitions use Admin command; deletion remains dedicated RGPD/Admin workflow |
| `src/app/actions/join.ts` | Auth creation, direct authority tuple update and separate invitation consumption | Single blocked provisioning route and atomic invitation/authority/audit finalization |
| `src/app/auth/actions.ts` | Public unaffiliated `auth.signUp` | Remove supported surface and disable public signup |
| `src/services/crm/shared.ts` | `ensureProfile` upsert, implicit Agent role and HQ fallback | Read-only trusted actor resolver that fails closed |
| `src/app/actions/invoicing.ts` | Fiscal profile/verification updates through service role | Retained dedicated fiscal commands/readers |
| `src/app/actions/withdrawals.ts` | Browser-session IBAN update and full-IBAN read | Dedicated masked banking workflow and authorized internal full read |
| `src/lib/drive/folders.ts` | Atomic `drive_folder_id` claim | Retained dedicated Drive claim workflow |

No other direct `profiles` INSERT/UPSERT was found outside the `ensureProfile` path. Direct profile UPDATE call sites found by local scan are the paths above. The repository-wide reader list below must be closed before contract.

## Local reader inventory

| Reader group | Current files | Required destination |
|---|---|---|
| Auth/route role resolution | `src/proxy.ts`, `src/lib/auth/permissions.ts`, `src/services/crm/shared.ts` | Trusted canonical actor/profile resolver; no writes or HQ fallback |
| Own profile/settings/onboarding | `src/app/actions/profile.ts`, `src/services/crm/profileFiscal.ts`, `src/features/gamification/hooks/useWallet.ts`, `src/services/crm/dashboard.ts` | Own identity projection plus dedicated fiscal/wallet readers |
| Admin/network/directory | `src/app/actions/admin.ts`, `src/app/actions/network.ts`, `src/services/crm/network.ts`, `src/app/dashboard/profile/[id]/page.tsx` | Row-scoped directory projection and Admin authority summaries |
| Fiscal, billing, wallet, invoicing | `src/app/actions/billing.ts`, `src/app/actions/invoicing.ts`, `src/app/actions/withdrawals.ts`, `src/app/actions/commissionManagement.ts` | Dedicated protected server reads; no direct fiscal/banking browser columns |
| CRM and tenancy | `src/services/crm/{dashboard,gamification,network,shared}.ts`, `src/services/crmService.ts`, `src/app/actions/{businessMetrics,capture,clients,crm,energy,geo,leadBulk,opportunities}.ts` | Minimal directory/authority projection or purpose-specific server adapter |
| OCR, proposals and public documents | `src/app/actions/{ocr,ocr-handoff,ocr-jobs,proposalActivities,proposals,publicProposal}.ts`, `src/app/api/proposal/[id]/pdf/route.ts` | Minimal authorized identity/relationship projection |
| System jobs and support | `src/lib/audit/logger.ts`, `src/lib/drive/{folders,driveHousekeeping}.ts`, `src/app/api/cron/weekly-summary/route.ts`, `src/app/actions/{conversion-queue,demo,franchise}.ts` | Explicit server-only projection or retained dedicated workflow |

PostgREST embedded joins to `profiles` also exist in audit, commission, lead, proposal and withdrawal queries. Their selected columns and row scope must be included in the Slice 2 reader contract scan even where `.from('profiles')` is not the root query.

## Auth and invitation paths

- Public signup: `src/app/auth/actions.ts`.
- Admin Auth creation: `src/app/actions/join.ts`.
- Admin Auth deletion: `src/app/actions/network.ts`.
- Invitation creation: `src/app/actions/network.ts` and `src/services/crm/network.ts`.
- Public validation and both consumption paths: `src/app/actions/join.ts`.
- Current validation exposes full invitation email and creator id; replacement must return only validity, masked email hint and localized role label.

## Reproducible commands

From the repository root:

```powershell
pwsh -NoProfile -File .\supabase\scripts\profile_authority_preflight.ps1
```

The runner prints only safe environment classification, sanitized Auth settings, migration versions, catalog metadata and aggregate anomaly counts. Never add debug output of the constructed database URL or environment values.

## Exit disposition

T1 is complete only when the runner result is copied or summarized below and every non-zero anomaly class has an explicit `compatible`, `Admin review` or `blocking` disposition. No repair belongs to T1.

### 2026-08-03 execution result

- Staging Auth settings: succeeded; public signup is enabled and email auto-confirm is disabled. An effective E2E password-login token lifetime of 3600 seconds was measured without emitting token/identity data, then the session was revoked.
- Staging Postgres connectivity through the documented `aws-1-eu-central-1` pooler: succeeded; server version `17.6`.
- Staging migration history: succeeded and aligned through `20260802110130`.
- The first catalog/data-quality attempt exposed an ACL-array verifier defect. After correcting the nullable ACL expansion, the complete aggregate query succeeded.
- Effective grants are currently broad: `anon` and `authenticated` have table privileges and column privileges over `profiles`, including `role`, `parent_id`, `franchise_id` and `iban`. RLS still controls rows, but it is not a safe column boundary.
- Staging has two Auth users, two profiles, one franchise and no invitations. There are no invalid/null roles, orphan parents/franchises, inactive-franchise references, self-parenting, cycles, banned users or invitation anomalies.
- One profile is a noncanonical Admin tuple and the count of canonical Admin tuples is zero. This is **Admin review/blocking for contract**: it must be corrected through the future audited authority workflow, never guessed or silently rewritten.
- No Auth-user trigger is present remotely. `profiles` has only the fiscal-mutation guard and timestamp trigger; there is no authority guard or append-only authority-event enforcement yet. This is expected RED evidence and **blocking for contract**.
- Dependent views were inventoried (`contract_renewal_data_quality`, `crm_work_queue`, `invoice_registry`, `proposals_alta`, `v_franchise_client_stats`) and must be proven compatible before the final column grant contract.
- Production was not queried or mutated. No schema, data or migration history was changed anywhere.

Disposition: **T1 is complete** and confirms the expected broad pre-contract surface. The Admin tuple, enabled signup, absent Auth trigger and missing authority guard are explicit implementation blockers for later slices, not preflight failures to repair in place. Every non-zero anomaly has a disposition and the artifact contains no PII.

# OCR PII and Tenant Boundary Requirements

Feature: `ZIN-SDD-042 ocr-pii-and-tenant-boundary`.

Status: `requirements_ready`; SDD Gate 1 approved by the product owner on 2026-08-03.

## Intent

Remove clear protected identifiers from persisted OCR payloads and make OCR access
match the role model: an Agent sees only their own jobs, a Franchise sees its
network and Admin sees global operations. The OCR-to-opportunity journey must keep
working without leaking PII through storage, Data API, Realtime, logs or errors.

## Current evidence

- OCR callback and OCR actions assign extracted invoice objects containing `cups`
  and `dni_cif` directly to `ocr_jobs.extracted_data`.
- `src/lib/crypto/pii.ts` already provides `encryptJson()`/`decryptJson()` for this
  exact type of sensitive JSON, but the active persistence paths do not use them.
- Versioned OCR SELECT/UPDATE policies authorize `franchise_id = get_my_franchise_id()`
  without first proving the requester is a Franchise supervisor, in addition to
  owner and Admin policies.
- Realtime currently sends a PII-free signal and fetches data through an
  authenticated action; this positive boundary must be preserved.

## Scope

In scope:

- Every OCR persistence/read path for `extracted_data`.
- CUPS/DNI encryption and blind-index equality where needed.
- Agent-own, Franchise-network and Admin-global OCR policies and grants.
- Safe remediation of existing clear protected identifiers.
- OCR callback, review, retry, reconciliation, Realtime and training-data boundaries.
- PII canary scans and authorized decrypt-boundary tests.

Out of scope:

- Changing OCR provider/model or extraction accuracy.
- Encrypting name/address in other domain tables; current project policy protects CUPS/DNI.
- OCR webhook signature/anti-replay, which is a separate feature after storage/isolation.
- Deleting source invoice files outside the existing retention/RGPD lifecycle.

## Requirements

[REQ-001] WHEN OCR output is persisted, the system shall ensure clear CUPS and DNI do not exist in `extracted_data` or any other unprotected JSON field.

Verification:

- New callback, retry and manual-completion paths pass canary scans with zero clear identifiers.
- Protected payload decryption occurs only inside an authorized server boundary.
- Equality lookup uses blind hashes rather than encrypted ciphertext.

[REQ-002] WHEN existing OCR rows contain clear CUPS/DNI, the system shall classify and remediate them without printing PII, guessing ownership or losing unrelated extracted fields.

Verification:

- A dry-run report outputs counts and safe IDs only.
- The repair is timestamped, resumable/idempotent and has a documented rollback/continuity plan.
- Post-repair canary scans find zero clear protected values in target storage.

[REQ-003] WHILE the requester has role `agent`, the system shall permit OCR access only when `agent_id` is that requester; shared `franchise_id` alone shall not grant sibling-agent access.

Verification:

- Two agents in the same franchise cannot read or update one another's OCR jobs through REST or application paths.
- Owner access remains functional.

[REQ-004] WHILE the requester has role `franchise`, the system shall permit read/supervision only for OCR jobs inside that franchise network; WHILE the requester has role `admin`, global access shall use the existing protected Admin boundary.

Verification:

- Franchise cannot access another network.
- Agent cannot obtain Franchise scope by sharing a franchise ID.
- Mutations remain limited to explicitly approved role actions.

[REQ-005] WHEN the OCR callback, server action, Realtime signal, notification or error path handles extracted data, the system shall minimize fields and emit no clear CUPS/DNI outside the authorized decrypt boundary.

Verification:

- Realtime payload remains a signal without `extracted_data`.
- Logs, errors, push content and audit metadata pass PII-redaction tests.
- Upstream free-text errors are mapped to safe codes/messages before persistence.

[REQ-006] WHEN OCR training data is stored or served, the system shall apply `sanitizeTrainingData` after authorized decryption and before crossing the training boundary.

Verification:

- Canary CUPS/DNI/name/address values are absent from training fixtures and outbound payloads.
- Failure to sanitize blocks the operation rather than storing raw data.

[REQ-007] IF encryption keys or protected payloads are unavailable, malformed or fail authentication, THEN the system shall fail closed, preserve the job for safe retry and expose a non-PII operational exception.

Verification:

- No plaintext fallback is written.
- The user receives a recoverable state without sensitive technical details.
- Retry is idempotent and does not duplicate opportunity effects.

[REQ-008] WHEN schema, representation, RLS or privilege changes are needed, the system shall use new migrations, regenerated types and linked-database verification across all roles.

Verification:

- Effective grants and policies are tested for anon, same-franchise agents, cross-franchise agent, Franchise, Admin and service role.
- Structural and transaction verifiers cover both encrypted storage and tenant isolation.
- Applied migrations are never rewritten.

[REQ-009] WHEN the feature is released, the OCR-to-opportunity flow shall retain its current idempotency, owner attribution, reconciliation and manual-review behavior.

Verification:

- Upload, callback, retry and human confirmation create/reuse the same canonical opportunity as before.
- No accepted proposal, price snapshot, commission or contract is modified by remediation.
- Authenticated desktop/mobile review works without PII in client errors or horizontal overflow.

## Properties / Invariants

- [INV-001] CUPS/DNI never exist in clear in OCR database JSON, logs, errors, events, metrics or training data.
- [INV-002] Agent scope is own OCR jobs, never all jobs sharing a franchise ID.
- [INV-003] Franchise supervision is explicit role-based network scope; Admin is the only global scope.
- [INV-004] Decryption occurs only on the authorized server and plaintext is not persisted again.
- [INV-005] Realtime and notification boundaries remain PII-free.
- [INV-006] Missing keys or corrupt ciphertext never trigger plaintext fallback.
- [INV-007] OCR reconciliation and downstream commercial effects remain idempotent.

## Success criteria

- Canary scans prove zero clear CUPS/DNI in new and remediated OCR storage and observability.
- Direct REST tests prove same-franchise agent isolation and correct Franchise/Admin visibility.
- The complete OCR upload/callback/review/retry journey retains canonical opportunity linkage.
- Security/RLS verifiers, focused tests, TypeScript, lint, unit suite and build pass.

## Open questions

- Choose during design between whole-payload encryption and a sanitized JSON plus dedicated encrypted fields, based on query/read compatibility.
- Confirm the production remediation window and operator for the timestamped legacy-data repair.

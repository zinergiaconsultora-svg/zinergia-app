# Requirements - End-to-End Flow Integrity

Feature: `end-to-end-flow-integrity`

Status: `approved`

## Scope

Fix concrete flow breaks found during the audit of OCR -> simulator -> proposal -> public acceptance. This feature does not introduce database schema changes.

## EARS Requirements

- [REQ-001] WHEN a user opens a completed OCR job for comparison from OCR history, invoice history, or the admin conversion queue, the system shall navigate to an existing simulator route.
- [REQ-002] WHEN invoice data is handed to the simulator from an existing OCR job, the system shall carry the originating `ocr_job_id` through to persisted proposals and OCR job comparison metadata.
- [REQ-003] WHEN an admin converts a queued OCR opportunity that belongs to an agent, the system shall preserve the original agent/franchise ownership for the client and proposals instead of assigning the conversion to the admin user.
- [REQ-004] WHEN a public proposal is accepted, the system shall execute the same business side effects as an authenticated acceptance: commission processing, lead closure, follow-up tasks, contract creation, activity logging, and notifications where applicable.
- [REQ-005] IF the ownership context supplied from an OCR handoff is invalid or unauthorized, THEN the system shall fall back to the current authenticated user's permitted context or reject the write without exposing sensitive details.
- [REQ-006] IF persistence fails after a simulator comparison, THEN the system shall surface a user-visible error instead of silently logging only to the console.

## Properties

- [INV-001] Proposal acceptance side effects must be idempotent.
- [INV-002] Public proposal acceptance must keep existing token validation, signature validation, and rate limiting.
- [INV-003] OCR extracted PII must not be added to URLs.
- [INV-004] No service-role key usage may be introduced outside the existing server-only service helper boundary.

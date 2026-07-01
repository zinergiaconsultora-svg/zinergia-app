# Requirements — ZIN-SDD-028 Admin Leads Empty Guidance

## Intent

Make the admin leads workflow clearer when a selected tab or operational queue has no results, so admins know whether the queue is healthy and what to do next.

## EARS Requirements

- [REQ-001] WHEN the admin leads list is empty with an operational queue selected, the system shall show queue-specific empty-state copy.
- [REQ-002] WHEN the admin leads list is empty without an operational queue selected, the system shall show outcome-specific empty-state copy for open, won, lost, or all leads.
- [REQ-003] The empty state shall explain the next operational action or confirmation in plain Spanish.
- [REQ-004] The leads filters, queue buttons, bulk actions, detail drawer, and mutation behavior shall remain unchanged.
- [REQ-005] The copy selection shall be covered by deterministic tests without requiring Supabase or browser credentials.

## Properties

- No database schema change is required.
- No PII is added to logs, errors, analytics, or test output.
- The change is presentation-only and does not modify lead query filters.

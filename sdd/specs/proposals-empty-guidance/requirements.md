# Requirements — ZIN-SDD-029 Proposals Empty Guidance

## Intent

Make the commercial proposals list more helpful when it has no proposals or when filters return no results, so agents know the next operational step.

## EARS Requirements

- [REQ-001] WHEN the proposals list has no proposals and no filters are active, the system shall explain that the agent must create a simulation and save it to CRM.
- [REQ-002] WHEN the proposals list has no results because search or advanced filters are active, the system shall explain how to recover results by clearing or relaxing filters.
- [REQ-003] WHEN the proposals list has no results because a status tab is selected, the system shall show status-specific guidance.
- [REQ-004] The proposals list shall preserve existing filtering, bulk actions, CSV export, view modes, and navigation behavior.
- [REQ-005] The empty-state copy selection shall be covered by deterministic tests without requiring Supabase, browser credentials, or network access.

## Properties

- No database schema change is required.
- No proposal mutation behavior changes.
- No PII is added to logs, errors, analytics, or test output.

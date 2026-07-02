# Requirements — Invoicing Empty Guidance

## Intent

Clarify the next operational step when the commercial invoicing page or invoice creation modal has no rows to show.

## EARS Requirements

- [REQ-001] WHEN the invoicing page has no invoices and the `Todas` filter is selected, the page shall explain that invoices appear after commissions are generated and selected for billing.
- [REQ-002] WHEN an invoice status filter has no invoices, the page shall show status-specific guidance instead of a generic empty message.
- [REQ-003] WHEN the invoice creation modal has no uninvoiced commissions, the modal shall explain that accepted proposals must generate payable commissions before an invoice can be created.
- [REQ-004] IF the invoicing actions or fetchers return an error, THEN the page shall keep the existing error state and retry behavior.

## Properties

- [INV-001] The change shall not modify invoice fetching, generation, issue, cancellation, or payment behavior.
- [INV-002] The change shall not introduce database schema, Supabase policy, or server action changes.
- [INV-003] Empty-state copy selection shall be covered by focused unit tests.

# Design — Invoicing Empty Guidance

## Scope

This is a presentation-only improvement for `src/app/dashboard/invoicing/page.tsx`.

## Approach

Create a pure helper next to the page:

- `src/app/dashboard/invoicing/emptyState.ts`
- `buildInvoicesEmptyState(filter)` returns copy for the invoice list.
- `buildUninvoicedCommissionsEmptyState()` returns copy for the modal when no commissions are available.

The page will use the helper only for empty states. Existing loading, error, KPI, filters, modal selection, invoice generation, issue, cancel, and mark-paid flows remain unchanged.

## Copy Model

- `all`: explain that invoices start from payable commissions.
- `draft`: no invoices are waiting to be issued.
- `issued`: no invoices are pending payment.
- `paid`: no paid invoices yet.
- `cancelled`: no cancelled invoices.
- modal without commissions: explain that accepted proposals with payable commissions are needed before invoice creation.

## Testing

Add focused Vitest coverage for the helper:

- first empty invoice list
- status-specific invoice empty states
- modal empty state for unavailable commissions

## Security And Data

No PII, RLS, Supabase, API, schema, or mutation behavior changes.

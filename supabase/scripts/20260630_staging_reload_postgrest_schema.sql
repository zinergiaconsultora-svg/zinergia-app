-- Target: staging only (dnzytocmtmnptndeczny), 2026-06-30.
-- Purpose: refresh PostgREST schema cache after staging reconciliation.

notify pgrst, 'reload schema';

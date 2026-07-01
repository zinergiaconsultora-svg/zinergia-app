# Design: Lead Analytics Helper Permission

## Cause

`get_lead_analytics()` was created with an admin guard that called `public.is_admin()`. Later hardening moved RLS helpers to `private.*` and revoked execution on the public wrappers. The admin page still called the analytics RPC, but Postgres rejected the nested `public.is_admin()` call.

## Fix

Replace `public.get_lead_analytics()` so it calls `private.is_admin()` explicitly. Keep the JSON aggregation body unchanged and re-assert function grants for `authenticated` and `service_role`.

## Security

This keeps public helper revocation intact and does not broaden anonymous access. Non-admin users still receive the same forbidden exception from the function, and the application action still calls `requireServerRole(['admin'])` before the RPC.

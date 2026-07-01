# Requirements: Lead Analytics Helper Permission

## Scope

Remove the runtime permission error in admin lead analytics after RLS helpers were moved out of the exposed public schema.

## Requirements

- [REQ-001] WHEN an admin opens lead analytics, the system shall execute `get_lead_analytics()` without calling revoked public helper functions.
- [REQ-002] WHEN a non-admin attempts to execute lead analytics, the database function shall continue to reject the request.
- [REQ-003] The fix shall preserve the previous analytics JSON shape.

## Invariants

- The public `is_admin()` helper remains non-executable by API roles.
- The migration does not change tables, columns, or RLS policies.
- The function remains callable only by authenticated/server roles that already pass application role checks.

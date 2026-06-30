# Security Review

## Scope

- Feature:
- Reviewer:
- Date:

## Checklist

- [ ] Mutations are authorized before writes.
- [ ] RLS/policies match intended role access.
- [ ] Service role use is absent or justified.
- [ ] PII is encrypted/hashed/sanitized as required.
- [ ] Public routes validate token, payload and rate limits.
- [ ] Cron routes validate `CRON_SECRET`.
- [ ] Errors and logs do not expose sensitive data.
- [ ] Tests cover permission failures and abuse cases where applicable.

## Findings

- <Finding or `None`>

## Decision

- [ ] Approved
- [ ] Changes required

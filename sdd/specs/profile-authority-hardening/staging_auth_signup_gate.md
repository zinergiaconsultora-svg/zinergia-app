# Staging Auth signup gate

Status: operator action required before T14 and the Slice 2 exit gate can close.

## Exact target

- Project: Zinergia staging only.
- Project ref: `dnzytocmtmnptndeczny`.
- Production ref `gmjgkzaxmkaggsyczwcm` is explicitly out of scope.

## Required change

In the Supabase dashboard for the exact staging project, disable public new-user signup for email/password. Admin-created users must remain available because invitation provisioning uses the Auth Admin API.

Do not run `supabase config push` from this repository for this change: that command pushes the complete local `config.toml`, including settings unrelated to this gate. Use the dashboard or a reviewed Management API `PATCH /v1/projects/dnzytocmtmnptndeczny/config/auth` containing only the signup field.

## Verification

Run the read-only project preflight:

```powershell
& 'supabase/scripts/profile_authority_preflight.ps1'
```

The `auth_settings_safe` result must contain `"disable_signup":true`. Stop if the resolved ref is not the exact staging ref above.

Then rerun the live blocked-Auth verifier:

```powershell
& 'scripts/profile-authority/verify-blocked-auth-staging.ps1'
```

Expected safe result:

```text
BLOCKED_AUTH_STAGING_OK neutral=true jwt=false cleanup=true production=false
```

Only after both checks pass may T14 be marked complete and the T16 contract migration be drafted. Production promotion remains separately unauthorized.

# Design - Vercel Archive Deploy

Feature: `vercel-archive-deploy`

Status: `approved`

## Finding

The post-merge production deploy for PR #74 built successfully but failed during `vercel deploy --prebuilt --prod` with Vercel CLI error `Too many requests - try again in 24 hours (more than 5000, code: "api-upload-free")`. The CLI recommendation and current Vercel docs point to `--archive=tgz` to compress deployment files and avoid upload limits for many-file deployments.

## Approach

Keep the existing build and deployment flow. Add `--archive=tgz` to both production and preview `vercel deploy --prebuilt` commands in `.github/workflows/ci-cd.yml`.

## Verification

- Confirm workflow contains archived deploy commands.
- SDD validator.
- Rely on PR/main CI to exercise the GitHub Actions workflow with Vercel.

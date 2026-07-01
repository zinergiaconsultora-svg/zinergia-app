# Requirements - Vercel Archive Deploy

Feature: `vercel-archive-deploy`

Status: `approved`

## Intent

Evitar que los deploys de Vercel fallen por limite de uploads del plan free al subir muchos archivos prebuilt desde GitHub Actions.

## Scope

In scope:

- Ajustar los comandos `vercel deploy --prebuilt` del workflow CI/CD para usar archivo `tgz`.
- Documentar la razon operativa del cambio.

Out of scope:

- Cambiar proveedor de deploy.
- Cambiar secrets, proyecto Vercel o configuracion de entorno.
- Cambiar build de Next.js.

## EARS Requirements

- [REQ-001] WHEN CI deploys prebuilt artifacts to production, the workflow shall pass `--archive=tgz` to Vercel CLI.
- [REQ-002] WHEN CI deploys prebuilt artifacts for preview, the workflow shall pass `--archive=tgz` to Vercel CLI.
- [REQ-003] WHEN the deploy package contains many files, the upload shall be compressed before upload to reduce file-count pressure.

## Properties

- [INV-001] Application runtime behavior is unchanged.
- [INV-002] No database migration is required.

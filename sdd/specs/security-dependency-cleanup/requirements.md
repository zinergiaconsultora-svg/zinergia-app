# Security Dependency Cleanup Requirements

Status: requirements approved on 2026-07-02.

## Intent

Eliminar advisories high de dependencias sin degradar flujos operativos de importación/exportación Excel ni relajar la visibilidad de seguridad en CI.

## Requirements

- [REQ-001] WHEN `npm audit --audit-level=high` runs, the dependency tree shall not report high severity vulnerabilities.
- [REQ-002] WHEN Excel import/export features run, the system shall preserve workbook parsing and writing behavior.
- [REQ-003] IF a vulnerable direct dependency has no fixed release in npm, THEN the system shall replace it with a maintained compatible package instead of suppressing the advisory.
- [REQ-004] WHEN framework/tooling patch updates are available and non-breaking, the system shall apply them through `package.json` and `package-lock.json`.

## Properties / Invariants

- [INV-001] No CI security threshold is weakened.
- [INV-002] Excel import/export call sites must not keep importing the vulnerable `xlsx` package.
- [INV-003] No database schema changes are required.

# Simulator Persistence Warning Requirements

Status: requirements approved on 2026-07-02.

## Intent

Hacer visible y recuperable el fallo de guardado CRM cuando la comparativa del simulador se calcula correctamente pero no se puede persistir la propuesta.

## Requirements

- [REQ-001] WHEN the simulator calculates comparison results successfully but CRM persistence fails, the system shall keep the comparison results visible.
- [REQ-002] WHEN CRM persistence fails after a successful comparison, the system shall show a non-blocking warning that the proposal is not saved in CRM.
- [REQ-003] IF the persistence warning is shown, THEN it shall not include CUPS, DNI/CIF, raw invoice payloads, public tokens, signed URLs, or database error details.
- [REQ-004] WHEN the user starts a new analysis or comparison attempt, the system shall clear stale persistence warnings.

## Properties / Invariants

- [INV-001] A calculated comparison must not be represented as fully saved unless a proposal id exists.
- [INV-002] Persistence failure messaging must stay recoverable and PII-safe.
- [INV-003] No schema change is required for this feature.

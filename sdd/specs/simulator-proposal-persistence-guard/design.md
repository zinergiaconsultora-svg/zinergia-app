# Design: Simulator Proposal Persistence Guard

## Overview

Extend existing proposal service tests. `logSimulation(...)` is already covered for the primary proposal. Add focused coverage for `saveProposal(...)`, which is used by the simulator to persist secondary comparison candidates after the best proposal.

## Scope

- No schema changes.
- No app behavior changes unless tests reveal drift.
- No external service calls.

## Test Strategy

Mock Supabase client, auth, franchise lookup, and OCR handoff context. Call `proposalService.saveProposal(...)` with a realistic proposal payload containing:

- `client_id`
- real UUID `ocr_job_id`
- pricing numbers
- `offer_snapshot`
- `calculation_data`

Assert that the insert payload includes:

- preserved `ocr_job_id`
- resolved `franchise_id`
- current user or handoff `agent_id`
- generated price snapshot metadata

This complements the existing `logSimulation(...)` tests and closes the primary/secondary proposal persistence path.

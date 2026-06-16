-- =============================================================================
-- Migration: Drop plaintext CUPS / DNI from `clients` (PII cutover — final step)
-- Date:      2026-06-16
-- Author:    Claude (PR B — completes the cutover started in 20260421090000)
--
-- Context
-- -------
-- 20260421090000 added the encrypted columns (cups_ciphertext / cups_hash /
-- dni_cif_ciphertext / dni_cif_hash) as a PURE ADDITION, intending a later
-- cutover that never landed. As of 2026-06-16 the application reads and writes
-- exclusively through the ciphertext + blind-index columns (see
-- src/lib/crypto/clientPii.ts and src/app/actions/clients.ts), and every
-- existing row has been verified to carry ciphertext for any plaintext value
-- (backfill dry-run: 0 rows pending).
--
-- This migration removes the now-unused plaintext columns and their index,
-- eliminating PII at rest in the clear.
--
-- PRE-CONDITIONS (must all hold before applying):
--   1. The application code that reads/writes only ciphertext is LIVE in
--      production (PR #27 deployed). Older code wrote plaintext `cups` and
--      would break against the dropped columns.
--   2. clients.cups_ciphertext is populated for every row where cups was set
--      (and likewise dni_cif). Verified via
--      supabase/scripts/20260616_backfill_client_pii.mjs --dry-run.
--
-- IRREVERSIBLE: this drops columns. The data is NOT lost — it remains
-- recoverable by decrypting the *_ciphertext columns — but the plaintext
-- columns themselves cannot be restored by a down-migration.
-- =============================================================================

BEGIN;

-- Index over the plaintext CUPS. Equality lookups now use idx_clients_cups_hash.
DROP INDEX IF EXISTS public.idx_clients_cups;

-- The plaintext PII columns. Reads go through *_ciphertext; equality through *_hash.
ALTER TABLE public.clients
    DROP COLUMN IF EXISTS cups,
    DROP COLUMN IF EXISTS dni_cif;

COMMIT;

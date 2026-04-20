-- =============================================================================
-- Migration: Add PII encryption columns to `clients`
-- Date:      2026-04-21
-- Author:    Claude (PR A — Foundation of PII encryption)
--
-- Purpose
-- -------
-- This migration prepares the `clients` table to store encrypted PII (CUPS
-- and DNI/NIF/CIF) alongside a deterministic blind-index hash for searchable
-- equality lookups. It is a PURE ADDITION — plaintext `cups` and `dni_cif`
-- columns are left untouched so the app keeps reading and writing them
-- exactly as before.
--
-- The integration migration (20260422_pii_encryption_cutover.sql, arrives
-- with PR B) will backfill these columns, flip reads to the ciphertext
-- columns, and eventually drop the plaintext ones.
--
-- Column semantics
-- ----------------
--   *_ciphertext  — output of src/lib/crypto/pii.ts::encrypt()
--                   Format: v1.<iv_b64url>.<tag_b64url>.<ct_b64url>
--                   Probabilistic (different every call for same plaintext).
--                   Max realistic length ~ plaintext + 60 bytes overhead,
--                   but we use `text` so we don't have to care.
--
--   *_hash        — output of src/lib/crypto/pii.ts::hashCups()/hashDni()
--                   64-char lowercase hex (HMAC-SHA-256 of normalized value).
--                   Deterministic, so it can be used in WHERE and UNIQUE
--                   indexes for duplicate detection.
--
-- Safety
-- ------
-- All new columns are NULLABLE and have no DEFAULT, so existing rows stay
-- valid. No application code reads these columns yet. Rolling this back is
-- just a column DROP.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- New columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS cups_ciphertext    text,
    ADD COLUMN IF NOT EXISTS cups_hash          text,
    ADD COLUMN IF NOT EXISTS dni_cif_ciphertext text,
    ADD COLUMN IF NOT EXISTS dni_cif_hash       text;

COMMENT ON COLUMN public.clients.cups_ciphertext IS
    'AES-256-GCM ciphertext of CUPS. Format: v1.<iv>.<tag>.<ct> (base64url). '
    'Encrypted in application layer via src/lib/crypto/pii.ts::encrypt(). '
    'Never stored in plaintext in backups once cutover migration runs.';

COMMENT ON COLUMN public.clients.cups_hash IS
    'HMAC-SHA-256 blind index of the normalized CUPS (uppercase, alphanum only). '
    'Used for equality lookups and uniqueness checks. 64-char lowercase hex.';

COMMENT ON COLUMN public.clients.dni_cif_ciphertext IS
    'AES-256-GCM ciphertext of DNI/NIF/CIF. Same format and contract as cups_ciphertext.';

COMMENT ON COLUMN public.clients.dni_cif_hash IS
    'HMAC-SHA-256 blind index of the normalized DNI/NIF/CIF (uppercase, alphanum only).';

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
-- Btree index on the blind index is cheap and lets us do
--   WHERE cups_hash = $1
-- with the same query shape the app already uses against plaintext `cups`.
--
-- We do NOT enforce UNIQUE yet: there may be legitimate duplicates in the
-- existing plaintext data (the baseline had no unique constraint either),
-- and backfill hasn't happened. The cutover migration will decide whether
-- to promote this to UNIQUE after de-duplication.

CREATE INDEX IF NOT EXISTS idx_clients_cups_hash
    ON public.clients USING btree (cups_hash)
    WHERE cups_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_dni_cif_hash
    ON public.clients USING btree (dni_cif_hash)
    WHERE dni_cif_hash IS NOT NULL;

COMMIT;

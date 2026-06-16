/**
 * Client PII helpers — encrypt-on-write / decrypt-on-read for the `clients`
 * table CUPS and DNI/CIF columns.
 *
 * This is the application-layer boundary that the cutover (PR B) relies on:
 *
 *   - On READ:  decryptClientPii() / hydrateClientRow() take a DB row with the
 *               `*_ciphertext` columns and return the plaintext CUPS / DNI for
 *               display, search and export. During the transition it falls back
 *               to the legacy plaintext columns when ciphertext is missing, so
 *               nothing breaks before the backfill runs. After the plaintext
 *               columns are dropped, the fallback is simply never reached.
 *
 *   - On WRITE: buildClientPiiColumns() turns a plaintext input into the set of
 *               encrypted + blind-index columns. It deliberately does NOT emit
 *               the plaintext `cups` / `dni_cif` columns — every write path must
 *               stop populating them.
 *
 * SERVER ONLY. These functions call into src/lib/crypto/pii.ts, which needs
 * APP_ENCRYPTION_KEY / APP_ENCRYPTION_PEPPER. Never import this from a client
 * component or browser-side service.
 */

import {
    decryptNullable,
    encryptNullable,
    hashCups,
    hashDni,
    normalizeCups,
    normalizeDni,
} from './pii';
import { moduleLogger } from '@/lib/logger';

const log = moduleLogger('client-pii');

// ---------------------------------------------------------------------------
// Read side
// ---------------------------------------------------------------------------

/** Shape of the PII-bearing columns we may receive from a `clients` row. */
export interface ClientPiiRow {
    /** Legacy plaintext column — present only during the transition. */
    cups?: string | null;
    /** Legacy plaintext column — present only during the transition. */
    dni_cif?: string | null;
    cups_ciphertext?: string | null;
    dni_cif_ciphertext?: string | null;
}

/** Decrypted CUPS / DNI ready for display. */
export interface ClientPiiPlain {
    cups: string | null;
    dni_cif: string | null;
}

/**
 * Safely decrypt one ciphertext, falling back to a legacy plaintext value when
 * the ciphertext is absent or cannot be decrypted. Never throws — a corrupt
 * ciphertext degrades to the plaintext (if any) or null, and is logged.
 */
function decryptField(
    ciphertext: string | null | undefined,
    plaintextFallback: string | null | undefined,
    field: 'cups' | 'dni_cif',
): string | null {
    if (ciphertext) {
        try {
            return decryptNullable(ciphertext);
        } catch (err) {
            log.warn(
                { field, errorMessage: err instanceof Error ? err.message : 'unknown' },
                'Client PII decrypt failed; falling back to plaintext column',
            );
        }
    }
    return plaintextFallback ?? null;
}

/**
 * Decrypt the PII of a single client row. Prefers the ciphertext columns and
 * falls back to the legacy plaintext columns during the transition.
 */
export function decryptClientPii(row: ClientPiiRow): ClientPiiPlain {
    return {
        cups: decryptField(row.cups_ciphertext, row.cups, 'cups'),
        dni_cif: decryptField(row.dni_cif_ciphertext, row.dni_cif, 'dni_cif'),
    };
}

/**
 * Return a copy of a DB row with `cups` / `dni_cif` populated from the
 * decrypted ciphertext, and the `*_ciphertext` fields stripped. The caller
 * keeps using `client.cups` / `client.dni_cif` exactly as before.
 */
export function hydrateClientRow<T extends ClientPiiRow>(
    row: T,
): Omit<T, 'cups_ciphertext' | 'dni_cif_ciphertext'> & ClientPiiPlain {
    const { cups, dni_cif } = decryptClientPii(row);
    const rest = { ...row } as Record<string, unknown>;
    delete rest.cups_ciphertext;
    delete rest.dni_cif_ciphertext;
    return { ...(rest as Omit<T, 'cups_ciphertext' | 'dni_cif_ciphertext'>), cups, dni_cif };
}

/** Hydrate an array of rows. */
export function hydrateClientRows<T extends ClientPiiRow>(
    rows: readonly T[],
): Array<Omit<T, 'cups_ciphertext' | 'dni_cif_ciphertext'> & ClientPiiPlain> {
    return rows.map(hydrateClientRow);
}

/** Columns to select so a row can be hydrated. Append to any clients SELECT. */
export const CLIENT_PII_SELECT = 'cups_ciphertext, dni_cif_ciphertext' as const;

// ---------------------------------------------------------------------------
// Write side
// ---------------------------------------------------------------------------

/** Plaintext PII input from a form, CSV row or OCR extraction. */
export interface ClientPiiInput {
    cups?: string | null;
    dni_cif?: string | null;
}

/** Encrypted + blind-index columns. Note: NO plaintext columns. */
export interface ClientPiiColumns {
    cups_ciphertext: string | null;
    cups_hash: string | null;
    dni_cif_ciphertext: string | null;
    dni_cif_hash: string | null;
}

/**
 * Build the encrypted column set for an insert/update from plaintext input.
 *
 * The CUPS / DNI are normalized (uppercase, alphanumerics only) before
 * encryption so the ciphertext and the blind-index hash stay consistent and
 * the decrypted display value is canonical.
 *
 * Empty / null inputs yield null columns. When a field is `undefined` the
 * corresponding columns are still returned as null — callers building a
 * partial UPDATE should pick only the keys they intend to change.
 */
export function buildClientPiiColumns(input: ClientPiiInput): ClientPiiColumns {
    const rawCups = input.cups?.trim() ? normalizeCups(input.cups) : '';
    const rawDni = input.dni_cif?.trim() ? normalizeDni(input.dni_cif) : '';

    return {
        cups_ciphertext: rawCups ? encryptNullable(rawCups) : null,
        cups_hash: rawCups ? hashCups(rawCups) : null,
        dni_cif_ciphertext: rawDni ? encryptNullable(rawDni) : null,
        dni_cif_hash: rawDni ? hashDni(rawDni) : null,
    };
}

/**
 * Build the CUPS-only encrypted columns. Useful for partial updates where only
 * the CUPS changed (e.g. the OCR webhook updating an existing client).
 */
export function buildCupsColumns(cups: string | null | undefined): Pick<ClientPiiColumns, 'cups_ciphertext' | 'cups_hash'> {
    const raw = cups?.trim() ? normalizeCups(cups) : '';
    return {
        cups_ciphertext: raw ? encryptNullable(raw) : null,
        cups_hash: raw ? hashCups(raw) : null,
    };
}

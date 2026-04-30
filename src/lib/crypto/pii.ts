/**
 * PII encryption — foundation module.
 *
 * Provides two primitives for sensitive fields stored in the database:
 *
 *   1. Probabilistic symmetric encryption (AES-256-GCM) for confidentiality.
 *      Every call to encrypt() uses a fresh random IV, so the same plaintext
 *      yields different ciphertexts. This rules out equality search on the
 *      ciphertext — use blindHash() for that.
 *
 *   2. Keyed blind index (HMAC-SHA-256 with a pepper) for searchable fields
 *      like CUPS and DNI. The hash is deterministic over the normalized
 *      input, so two equal plaintexts always hash to the same value and can
 *      be used in WHERE clauses.
 *
 * Ciphertext format (versioned, URL/SQL safe):
 *
 *      v1.<iv_b64url>.<tag_b64url>.<ct_b64url>
 *
 * The leading `v1.` lets us rotate the algorithm/key later while keeping
 * old ciphertexts decryptable.
 *
 * Key material is loaded lazily from environment variables so this module
 * can be imported in environments (e.g. test fixtures, type checks) where
 * the keys are not yet configured. Missing keys throw at use time, not at
 * import time — but the env schema flags them as required in production.
 *
 * NEVER log plaintexts. NEVER use blindHash as a password hash — it's a
 * blind index, not a password KDF. For passwords use bcrypt/argon2.
 */

import {
    createCipheriv,
    createDecipheriv,
    createHmac,
    randomBytes,
    timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;           // 12 bytes is the standard IV length for AES-GCM
const AUTH_TAG_LENGTH = 16;     // 16-byte GCM authentication tag
const KEY_LENGTH = 32;          // AES-256 → 32 bytes
const CURRENT_VERSION = 'v1';

// ---------------------------------------------------------------------------
// Key loading
// ---------------------------------------------------------------------------

interface KeyMaterial {
    readonly encryptionKey: Buffer;
    readonly pepper: Buffer;
}

let cached: KeyMaterial | null = null;

function loadKeyMaterial(): KeyMaterial {
    if (cached) return cached;

    const rawKey = process.env.APP_ENCRYPTION_KEY;
    const rawPepper = process.env.APP_ENCRYPTION_PEPPER;

    if (!rawKey) {
        throw new Error(
            'APP_ENCRYPTION_KEY is not set. Generate one with `node scripts/generate-encryption-keys.mjs` and add it to your environment.',
        );
    }
    if (!rawPepper) {
        throw new Error(
            'APP_ENCRYPTION_PEPPER is not set. Generate one with `node scripts/generate-encryption-keys.mjs` and add it to your environment.',
        );
    }

    const encryptionKey = Buffer.from(rawKey, 'base64');
    if (encryptionKey.length !== KEY_LENGTH) {
        throw new Error(
            `APP_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${encryptionKey.length}). It must be a base64-encoded 32-byte random value.`,
        );
    }

    // Pepper is stored as hex for readability; 32 bytes = 64 hex chars.
    const pepper = Buffer.from(rawPepper, 'hex');
    if (pepper.length < 16) {
        throw new Error(
            `APP_ENCRYPTION_PEPPER must decode to at least 16 bytes of hex (got ${pepper.length}).`,
        );
    }

    cached = { encryptionKey, pepper };
    return cached;
}

/**
 * Test-only helper: wipe the cached key material so tests can swap env vars
 * between cases. Not exported from the package index.
 */
export function __resetKeyCacheForTests(): void {
    cached = null;
}

// ---------------------------------------------------------------------------
// Base64URL helpers (no padding, URL/SQL safe)
// ---------------------------------------------------------------------------

function toB64Url(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Buffer {
    const padLen = (4 - (s.length % 4)) % 4;
    const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
    return Buffer.from(padded, 'base64');
}

// ---------------------------------------------------------------------------
// Encryption / decryption
// ---------------------------------------------------------------------------

/**
 * Encrypt a UTF-8 plaintext with AES-256-GCM.
 *
 * Each call produces a different ciphertext for the same input (probabilistic).
 * Returns a versioned string safe to store in a text column.
 */
export function encrypt(plaintext: string): string {
    const { encryptionKey } = loadKeyMaterial();

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${CURRENT_VERSION}.${toB64Url(iv)}.${toB64Url(tag)}.${toB64Url(ct)}`;
}

/**
 * Decrypt a ciphertext produced by encrypt(). Throws if the format is
 * invalid, the version is unknown, the key material doesn't match, or the
 * authentication tag fails.
 */
export function decrypt(ciphertext: string): string {
    const { encryptionKey } = loadKeyMaterial();

    const parts = ciphertext.split('.');
    if (parts.length !== 4) {
        throw new Error('Invalid ciphertext format: expected 4 dot-separated parts');
    }
    const [version, ivB64, tagB64, ctB64] = parts;
    if (version !== CURRENT_VERSION) {
        throw new Error(`Unsupported ciphertext version: ${version}`);
    }

    const iv = fromB64Url(ivB64);
    const tag = fromB64Url(tagB64);
    const ct = fromB64Url(ctB64);

    if (iv.length !== IV_LENGTH) {
        throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }
    if (tag.length !== AUTH_TAG_LENGTH) {
        throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${tag.length}`);
    }

    const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
}

/** encrypt() that passes through null/undefined — useful for optional columns. */
export function encryptNullable(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined || plaintext === '') return null;
    return encrypt(plaintext);
}

/** decrypt() that passes through null/undefined — useful for optional columns. */
export function decryptNullable(ciphertext: string | null | undefined): string | null {
    if (ciphertext === null || ciphertext === undefined || ciphertext === '') return null;
    return decrypt(ciphertext);
}

/**
 * Encrypt an arbitrary JSON-serializable value. The whole payload becomes a
 * single opaque ciphertext — individual keys are NOT searchable. Use this
 * for jsonb columns whose content is PII (e.g. `ocr_jobs.extracted_data`).
 */
export function encryptJson(value: unknown): string {
    return encrypt(JSON.stringify(value));
}

/** Inverse of encryptJson(). Returns the parsed value. */
export function decryptJson<T = unknown>(ciphertext: string): T {
    return JSON.parse(decrypt(ciphertext)) as T;
}

// ---------------------------------------------------------------------------
// Blind index (searchable deterministic hash)
// ---------------------------------------------------------------------------

/**
 * Produce a keyed blind index over the normalized plaintext.
 *
 * The result is a 64-char lowercase hex string (HMAC-SHA-256) and can be
 * stored in a text column plus a btree/hash index for equality lookups.
 *
 * The caller is responsible for normalizing the input before hashing, or
 * using one of the `hash*` helpers below which normalize for you.
 */
export function blindHashRaw(normalizedInput: string): string {
    const { pepper } = loadKeyMaterial();
    return createHmac('sha256', pepper).update(normalizedInput, 'utf8').digest('hex');
}

/** Constant-time hex string comparison. */
export function hashesEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Normalization + specialized hash helpers
// ---------------------------------------------------------------------------

/** CUPS: uppercase, keep alphanumerics only (strips spaces, hyphens, dots). */
export function normalizeCups(raw: string): string {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** DNI / NIF / CIF: uppercase, keep alphanumerics only. */
export function normalizeDni(raw: string): string {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Email: lowercase, trim. Does not validate shape. */
export function normalizeEmail(raw: string): string {
    return raw.trim().toLowerCase();
}

/** Phone: keep digits and leading `+`. */
export function normalizePhone(raw: string): string {
    const trimmed = raw.trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    return hasPlus ? `+${digits}` : digits;
}

export function hashCups(raw: string): string {
    return blindHashRaw(normalizeCups(raw));
}

export function hashDni(raw: string): string {
    return blindHashRaw(normalizeDni(raw));
}

export function hashEmail(raw: string): string {
    return blindHashRaw(normalizeEmail(raw));
}

export function hashPhone(raw: string): string {
    return blindHashRaw(normalizePhone(raw));
}

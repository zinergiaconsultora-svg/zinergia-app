/**
 * Tests for the PII encryption foundation module.
 *
 * These tests generate fresh key material in beforeAll() so they don't depend
 * on the developer having real keys configured in their environment.
 */

import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    __resetKeyCacheForTests,
    blindHashRaw,
    decrypt,
    decryptJson,
    decryptNullable,
    encrypt,
    encryptJson,
    encryptNullable,
    hashCups,
    hashDni,
    hashEmail,
    hashPhone,
    hashesEqual,
    normalizeCups,
    normalizeDni,
    normalizeEmail,
    normalizePhone,
} from '../pii';

const ORIGINAL_KEY = process.env.APP_ENCRYPTION_KEY;
const ORIGINAL_PEPPER = process.env.APP_ENCRYPTION_PEPPER;

beforeAll(() => {
    // Fresh 32-byte key (base64) and 32-byte pepper (hex) for this test run.
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.APP_ENCRYPTION_PEPPER = randomBytes(32).toString('hex');
    __resetKeyCacheForTests();
});

afterAll(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.APP_ENCRYPTION_KEY;
    else process.env.APP_ENCRYPTION_KEY = ORIGINAL_KEY;
    if (ORIGINAL_PEPPER === undefined) delete process.env.APP_ENCRYPTION_PEPPER;
    else process.env.APP_ENCRYPTION_PEPPER = ORIGINAL_PEPPER;
    __resetKeyCacheForTests();
});

describe('encrypt / decrypt', () => {
    it('roundtrips a UTF-8 string', () => {
        const pt = 'ES1234000000000001JK0F';
        const ct = encrypt(pt);
        expect(decrypt(ct)).toBe(pt);
    });

    it('roundtrips non-ASCII content (emoji, accents)', () => {
        const pt = 'Jesús Martínez — piso 3º, €100 💡';
        expect(decrypt(encrypt(pt))).toBe(pt);
    });

    it('produces a different ciphertext each call for the same plaintext', () => {
        const pt = 'hello';
        const a = encrypt(pt);
        const b = encrypt(pt);
        expect(a).not.toBe(b);
        expect(decrypt(a)).toBe(pt);
        expect(decrypt(b)).toBe(pt);
    });

    it('uses the versioned v1.iv.tag.ct format', () => {
        const ct = encrypt('x');
        const parts = ct.split('.');
        expect(parts.length).toBe(4);
        expect(parts[0]).toBe('v1');
    });

    it('throws on an unknown version prefix', () => {
        const ct = encrypt('x').replace(/^v1\./, 'v9.');
        expect(() => decrypt(ct)).toThrow(/version/i);
    });

    it('throws on a malformed ciphertext', () => {
        expect(() => decrypt('not-a-ciphertext')).toThrow();
        expect(() => decrypt('v1.aaa')).toThrow();
    });

    it('throws when the auth tag fails verification (tampered ciphertext)', () => {
        const ct = encrypt('sensitive');
        const parts = ct.split('.');
        // Flip a byte in the ct section by replacing its first char.
        const ctBytes = parts[3];
        const bumped = (ctBytes[0] === 'A' ? 'B' : 'A') + ctBytes.slice(1);
        const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${bumped}`;
        expect(() => decrypt(tampered)).toThrow();
    });
});

describe('encryptNullable / decryptNullable', () => {
    it('passes through null, undefined, and empty string', () => {
        expect(encryptNullable(null)).toBeNull();
        expect(encryptNullable(undefined)).toBeNull();
        expect(encryptNullable('')).toBeNull();
        expect(decryptNullable(null)).toBeNull();
        expect(decryptNullable(undefined)).toBeNull();
        expect(decryptNullable('')).toBeNull();
    });

    it('encrypts and decrypts non-empty values', () => {
        const ct = encryptNullable('12345678Z');
        expect(ct).not.toBeNull();
        expect(decryptNullable(ct)).toBe('12345678Z');
    });
});

describe('encryptJson / decryptJson', () => {
    it('roundtrips an object', () => {
        const value = { cups: 'ES123', meta: { region: 'ES', n: 42 } };
        const ct = encryptJson(value);
        expect(decryptJson(ct)).toEqual(value);
    });

    it('roundtrips an array', () => {
        const value = [1, 'two', { three: true }];
        expect(decryptJson(encryptJson(value))).toEqual(value);
    });

    it('roundtrips null', () => {
        expect(decryptJson(encryptJson(null))).toBeNull();
    });
});

describe('blindHashRaw', () => {
    it('is deterministic for the same input', () => {
        expect(blindHashRaw('abc')).toBe(blindHashRaw('abc'));
    });

    it('produces different hashes for different inputs', () => {
        expect(blindHashRaw('abc')).not.toBe(blindHashRaw('abd'));
    });

    it('returns a 64-char lowercase hex string (SHA-256)', () => {
        const h = blindHashRaw('test');
        expect(h).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('hashesEqual', () => {
    it('returns true for identical hashes', () => {
        const h = blindHashRaw('same');
        expect(hashesEqual(h, h)).toBe(true);
    });

    it('returns false for different hashes', () => {
        expect(hashesEqual(blindHashRaw('a'), blindHashRaw('b'))).toBe(false);
    });

    it('returns false for different-length inputs without throwing', () => {
        expect(hashesEqual('aa', 'aaaa')).toBe(false);
    });
});

describe('normalization', () => {
    it('normalizeCups uppercases and strips non-alphanumerics', () => {
        expect(normalizeCups(' es-1234 0000.0000 0001 jk 0f ')).toBe('ES1234000000000001JK0F');
    });

    it('normalizeDni uppercases and strips non-alphanumerics', () => {
        expect(normalizeDni(' 12.345.678-z ')).toBe('12345678Z');
    });

    it('normalizeEmail lowercases and trims', () => {
        expect(normalizeEmail('  Foo.Bar@Example.COM  ')).toBe('foo.bar@example.com');
    });

    it('normalizePhone keeps digits and leading +', () => {
        expect(normalizePhone(' +34 600 123 456 ')).toBe('+34600123456');
        expect(normalizePhone('600-123-456')).toBe('600123456');
    });
});

describe('specialized hash helpers', () => {
    it('hashCups matches across differently-formatted equal values', () => {
        expect(hashCups('ES1234000000000001JK0F')).toBe(hashCups('es-1234 0000.0000 0001 jk 0f'));
    });

    it('hashDni matches across differently-formatted equal values', () => {
        expect(hashDni('12345678Z')).toBe(hashDni('12.345.678-z'));
    });

    it('hashEmail matches across case differences', () => {
        expect(hashEmail('foo@example.com')).toBe(hashEmail('  FOO@Example.COM  '));
    });

    it('hashPhone matches across separator differences', () => {
        expect(hashPhone('+34 600 123 456')).toBe(hashPhone('+34-600-123-456'));
    });

    it('distinct inputs produce distinct hashes', () => {
        expect(hashCups('ES0001')).not.toBe(hashCups('ES0002'));
    });
});

describe('key material validation', () => {
    it('throws if APP_ENCRYPTION_KEY is missing', () => {
        const saved = process.env.APP_ENCRYPTION_KEY;
        delete process.env.APP_ENCRYPTION_KEY;
        __resetKeyCacheForTests();
        try {
            expect(() => encrypt('x')).toThrow(/APP_ENCRYPTION_KEY/);
        } finally {
            process.env.APP_ENCRYPTION_KEY = saved;
            __resetKeyCacheForTests();
        }
    });

    it('throws if APP_ENCRYPTION_KEY is the wrong length', () => {
        const saved = process.env.APP_ENCRYPTION_KEY;
        process.env.APP_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
        __resetKeyCacheForTests();
        try {
            expect(() => encrypt('x')).toThrow(/32 bytes/);
        } finally {
            process.env.APP_ENCRYPTION_KEY = saved;
            __resetKeyCacheForTests();
        }
    });

    it('throws if APP_ENCRYPTION_PEPPER is too short', () => {
        const saved = process.env.APP_ENCRYPTION_PEPPER;
        process.env.APP_ENCRYPTION_PEPPER = 'abcd'; // 2 bytes
        __resetKeyCacheForTests();
        try {
            expect(() => blindHashRaw('x')).toThrow(/PEPPER/);
        } finally {
            process.env.APP_ENCRYPTION_PEPPER = saved;
            __resetKeyCacheForTests();
        }
    });
});

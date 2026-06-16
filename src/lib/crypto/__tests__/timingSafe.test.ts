import { describe, it, expect } from 'vitest';
import { safeStringEqual } from '../timingSafe';

describe('safeStringEqual', () => {
    it('returns true for identical strings', () => {
        expect(safeStringEqual('s3cr3t-key', 's3cr3t-key')).toBe(true);
    });

    it('returns false for different strings of equal length', () => {
        expect(safeStringEqual('aaaaaa', 'aaaaab')).toBe(false);
    });

    it('returns false for different lengths', () => {
        expect(safeStringEqual('short', 'a-much-longer-value')).toBe(false);
    });

    it('fails closed on null / undefined / empty', () => {
        expect(safeStringEqual(null, 'x')).toBe(false);
        expect(safeStringEqual('x', undefined)).toBe(false);
        expect(safeStringEqual(undefined, undefined)).toBe(false);
        expect(safeStringEqual('', 'x')).toBe(false);
    });

    it('treats empty vs empty as equal', () => {
        // Both empty hash to the same digest; acceptable since callers fail closed
        // on missing secrets before reaching here.
        expect(safeStringEqual('', '')).toBe(true);
    });
});

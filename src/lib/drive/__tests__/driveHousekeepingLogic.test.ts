import { describe, it, expect } from 'vitest';
import { findOrphanFileIds, isQuotaOverThreshold } from '../driveHousekeepingLogic';

describe('findOrphanFileIds', () => {
    it('returns files whose documentId is not among existing jobs', () => {
        const files = [
            { id: 'f1', documentId: 'job-1' }, // exists
            { id: 'f2', documentId: 'job-2' }, // orphan
            { id: 'f3', documentId: null },    // no documentId → ignored
        ];
        const existing = new Set(['job-1']);
        expect(findOrphanFileIds(files, existing)).toEqual(['f2']);
    });

    it('returns empty when all files map to existing jobs', () => {
        const files = [{ id: 'f1', documentId: 'job-1' }];
        expect(findOrphanFileIds(files, new Set(['job-1']))).toEqual([]);
    });
});

describe('isQuotaOverThreshold', () => {
    it('flags usage at/over the threshold', () => {
        expect(isQuotaOverThreshold(80, 100, 0.8)).toBe(true);
        expect(isQuotaOverThreshold(81, 100, 0.8)).toBe(true);
    });
    it('does not flag usage under the threshold', () => {
        expect(isQuotaOverThreshold(79, 100, 0.8)).toBe(false);
    });
    it('treats unlimited (null) or zero limit as never over', () => {
        expect(isQuotaOverThreshold(999, null, 0.8)).toBe(false);
        expect(isQuotaOverThreshold(999, 0, 0.8)).toBe(false);
    });
});

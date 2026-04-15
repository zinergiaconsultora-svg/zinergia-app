import { describe, it, expect } from 'vitest';
import {
    aggregateOcrMetrics,
    emptyOcrMetrics,
    normalizeError,
    zeroFillDays,
    type OcrJobRow,
} from '../metrics';

const FIXED_NOW = new Date('2026-04-15T14:00:00Z');

function row(partial: Partial<OcrJobRow>): OcrJobRow {
    return {
        status: partial.status ?? 'completed',
        created_at: partial.created_at ?? '2026-04-15T10:00:00Z',
        error_message: partial.error_message ?? null,
    };
}

describe('normalizeError', () => {
    it('masks UUIDs so the same template groups together', () => {
        const a = normalizeError('Job 550e8400-e29b-41d4-a716-446655440000 failed');
        const b = normalizeError('Job 11111111-2222-3333-4444-555555555555 failed');
        expect(a).toBe(b);
    });

    it('masks HTTP status codes', () => {
        expect(normalizeError('N8N rechazó: HTTP 502')).toBe(normalizeError('N8N rechazó: HTTP 504'));
    });

    it('masks long numeric timestamps', () => {
        const a = normalizeError('Failed at 1712345678901');
        const b = normalizeError('Failed at 1734567890123');
        expect(a).toBe(b);
    });

    it('truncates to 140 chars', () => {
        const long = 'x'.repeat(500);
        expect(normalizeError(long)).toHaveLength(140);
    });

    it('is case-insensitive for UUIDs', () => {
        const a = normalizeError('x 550e8400-e29b-41d4-a716-446655440000');
        const b = normalizeError('X 550E8400-E29B-41D4-A716-446655440000');
        expect(a.toLowerCase()).toBe(b.toLowerCase());
    });
});

describe('zeroFillDays', () => {
    it('produces exactly windowDays buckets', () => {
        const out = zeroFillDays([], 7, FIXED_NOW);
        expect(out).toHaveLength(7);
    });

    it('orders days chronologically (oldest first, today last)', () => {
        const out = zeroFillDays([], 5, FIXED_NOW);
        const days = out.map(d => d.day);
        expect(days).toEqual([...days].sort());
        expect(days[days.length - 1]).toBe('2026-04-15');
    });

    it('assigns each row to the correct day bucket', () => {
        const out = zeroFillDays([
            row({ status: 'completed', created_at: '2026-04-15T09:00:00Z' }),
            row({ status: 'completed', created_at: '2026-04-15T10:00:00Z' }),
            row({ status: 'failed',    created_at: '2026-04-14T23:59:00Z' }),
        ], 3, FIXED_NOW);

        const byDay = new Map(out.map(d => [d.day, d]));
        expect(byDay.get('2026-04-15')).toEqual({ day: '2026-04-15', total: 2, completed: 2, failed: 0 });
        expect(byDay.get('2026-04-14')).toEqual({ day: '2026-04-14', total: 1, completed: 0, failed: 1 });
        expect(byDay.get('2026-04-13')).toEqual({ day: '2026-04-13', total: 0, completed: 0, failed: 0 });
    });

    it('ignores rows outside the window', () => {
        const out = zeroFillDays([
            row({ created_at: '2024-01-01T00:00:00Z' }), // way outside
        ], 3, FIXED_NOW);
        expect(out.reduce((sum, d) => sum + d.total, 0)).toBe(0);
    });

    it('does not count "processing" rows toward completed or failed', () => {
        const out = zeroFillDays([
            row({ status: 'processing', created_at: '2026-04-15T09:00:00Z' }),
        ], 1, FIXED_NOW);
        expect(out[0]).toEqual({ day: '2026-04-15', total: 1, completed: 0, failed: 0 });
    });
});

describe('aggregateOcrMetrics', () => {
    it('counts statuses correctly', () => {
        const m = aggregateOcrMetrics([
            row({ status: 'completed' }),
            row({ status: 'completed' }),
            row({ status: 'failed', error_message: 'boom' }),
            row({ status: 'processing' }),
        ], 30);
        expect(m.completed).toBe(2);
        expect(m.failed).toBe(1);
        expect(m.processing).toBe(1);
        expect(m.total).toBe(4);
    });

    it('computes successRate over terminal jobs only', () => {
        const m = aggregateOcrMetrics([
            row({ status: 'completed' }),
            row({ status: 'completed' }),
            row({ status: 'completed' }),
            row({ status: 'failed', error_message: 'x' }),
            row({ status: 'processing' }), // excluded from successRate denominator
        ], 30);
        // 3 completed / (3 completed + 1 failed) = 0.75
        expect(m.successRate).toBeCloseTo(0.75);
    });

    it('returns 0 successRate when no terminal jobs exist', () => {
        const m = aggregateOcrMetrics([
            row({ status: 'processing' }),
            row({ status: 'processing' }),
        ], 30);
        expect(m.successRate).toBe(0);
    });

    it('groups similar errors after normalization', () => {
        const m = aggregateOcrMetrics([
            row({ status: 'failed', error_message: 'N8N rechazó: HTTP 502' }),
            row({ status: 'failed', error_message: 'N8N rechazó: HTTP 504' }),
            row({ status: 'failed', error_message: 'N8N rechazó: HTTP 503' }),
            row({ status: 'failed', error_message: 'Other error' }),
        ], 30);
        // All three HTTP variants should collapse into one bucket.
        expect(m.topErrors[0].count).toBe(3);
        expect(m.topErrors[0].message).toBe('N8N rechazó: HTTP <code>');
    });

    it('caps topErrors at 5 entries', () => {
        const rows: OcrJobRow[] = [];
        for (let i = 0; i < 10; i++) {
            rows.push(row({ status: 'failed', error_message: `error type ${i}` }));
        }
        const m = aggregateOcrMetrics(rows, 30);
        expect(m.topErrors).toHaveLength(5);
    });

    it('orders topErrors by descending count', () => {
        const m = aggregateOcrMetrics([
            row({ status: 'failed', error_message: 'A' }),
            row({ status: 'failed', error_message: 'B' }),
            row({ status: 'failed', error_message: 'B' }),
            row({ status: 'failed', error_message: 'C' }),
            row({ status: 'failed', error_message: 'C' }),
            row({ status: 'failed', error_message: 'C' }),
        ], 30);
        expect(m.topErrors.map(e => e.count)).toEqual([3, 2, 1]);
    });

    it('ignores rows without error_message in topErrors', () => {
        const m = aggregateOcrMetrics([
            row({ status: 'failed', error_message: null }),
            row({ status: 'failed', error_message: null }),
        ], 30);
        expect(m.topErrors).toEqual([]);
        expect(m.failed).toBe(2);
    });
});

describe('emptyOcrMetrics', () => {
    it('returns a valid empty shape with correct windowDays', () => {
        const m = emptyOcrMetrics(14);
        expect(m.windowDays).toBe(14);
        expect(m.daily).toHaveLength(14);
        expect(m.total).toBe(0);
        expect(m.successRate).toBe(0);
        expect(m.topErrors).toEqual([]);
    });
});

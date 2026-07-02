import { describe, expect, it } from 'vitest';
import {
    buildOcrObservabilityMetrics,
    normalizeOcrErrorMessage,
    type OcrObservabilityRow,
} from '@/lib/ocr/observability';

function row(overrides: Partial<OcrObservabilityRow>): OcrObservabilityRow {
    return {
        id: 'job-1',
        status: 'completed',
        created_at: '2026-07-02T08:00:00.000Z',
        updated_at: '2026-07-02T08:02:00.000Z',
        attempts: 1,
        error_message: null,
        agent_id: 'agent-1',
        drive_synced_at: null,
        compared_at: null,
        ...overrides,
    };
}

describe('ocr observability metrics', () => {
    it('summarizes OCR health without needing invoice payload fields', () => {
        const metrics = buildOcrObservabilityMetrics([
            row({ id: 'completed-1', status: 'completed', drive_synced_at: '2026-07-02T08:04:00.000Z', compared_at: '2026-07-02T08:05:00.000Z' }),
            row({ id: 'failed-1', status: 'failed', error_message: 'N8N rechazó CUPS ES12345678901234567890 para usuario demo@example.com', attempts: 2 }),
            row({ id: 'processing-1', status: 'processing', updated_at: '2026-07-02T07:30:00.000Z', agent_id: 'agent-2' }),
        ], new Date('2026-07-02T08:00:00.000Z'));

        expect(metrics.last24h).toMatchObject({
            total: 3,
            completed: 1,
            failed: 1,
            processing: 1,
            completionRate: 33,
            failureRate: 33,
        });
        expect(metrics.staleProcessing).toBe(1);
        expect(metrics.retryPressure).toBe(1);
        expect(metrics.affectedAgents30d).toBe(2);
        expect(metrics.driveArchiveCoverage).toBe(100);
        expect(metrics.comparisonCoverage).toBe(100);
        expect(metrics.frequentErrors[0]).toEqual({
            message: 'N8N rechazó CUPS [CUPS] para usuario [EMAIL]',
            count: 1,
        });
    });

    it('sanitizes operational error buckets before rendering them to admins', () => {
        expect(normalizeOcrErrorMessage(
            'Error para ES0021000000000000AB1P y 12345678Z en https://example.test/file.pdf',
        )).toBe('Error para [CUPS] y [DNI] en [URL]');
    });
});

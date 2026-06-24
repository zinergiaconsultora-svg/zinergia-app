import { describe, expect, it } from 'vitest';
import { buildOperationalQueuePatch, OPERATIONAL_QUEUES } from '../operationalQueues';

describe('operational lead queues', () => {
    it('defines the expected operational queues in display order', () => {
        expect(OPERATIONAL_QUEUES.map((queue) => queue.value)).toEqual([
            'drive_pending',
            'ocr_failed',
            'needs_comparison',
            'permanence_due',
            'needs_review',
            'cooling',
        ]);
    });

    it('switches to all outcomes when an operational queue is activated', () => {
        expect(buildOperationalQueuePatch(undefined, 'drive_pending')).toEqual({
            outcome: 'all',
            queue: 'drive_pending',
        });
    });

    it('clears the active queue when it is selected again', () => {
        expect(buildOperationalQueuePatch('ocr_failed', 'ocr_failed')).toEqual({
            queue: undefined,
        });
    });
});

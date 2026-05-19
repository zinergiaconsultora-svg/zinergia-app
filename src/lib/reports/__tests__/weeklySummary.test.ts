import { describe, expect, it } from 'vitest';
import { buildWeeklySummaryContent } from '../weeklySummary';

describe('buildWeeklySummaryContent', () => {
    it('builds actionable content with commercial metrics', () => {
        const content = buildWeeklySummaryContent({
            wonThisWeek: 2,
            urgentFollowups: 3,
            unauditedClients: 1,
            pendingCommissions: 4,
            conversionRate30d: 25,
        }, new Date('2026-05-04T08:00:00.000Z'));

        expect(content.hasActionableItems).toBe(true);
        expect(content.body).toContain('2 ventas');
        expect(content.body).toContain('Conversion 30d: 25%');
        expect(content.html).toContain('Abrir dashboard');
    });

    it('still reports conversion when there are no action items', () => {
        const content = buildWeeklySummaryContent({
            wonThisWeek: 0,
            urgentFollowups: 0,
            unauditedClients: 0,
            pendingCommissions: 0,
            conversionRate30d: 0,
        });

        expect(content.hasActionableItems).toBe(false);
        expect(content.body).toBe('Conversion 30d: 0%');
    });
});

import { describe, expect, it } from 'vitest';
import {
    daysUntilContractEnd,
    resolveRenewalReminderThreshold,
} from '../canonical';

describe('canonical contract renewal reminders', () => {
    it.each([
        ['2026-09-29', 60, 60],
        ['2026-09-30', 61, null],
        ['2026-08-30', 30, 30],
        ['2026-08-07', 7, 7],
        ['2026-07-31', 0, 0],
        ['2026-07-20', -11, 0],
    ] as const)('classifies %s at the correct reminder boundary', (endDate, days, threshold) => {
        expect(daysUntilContractEnd(endDate, '2026-07-31')).toBe(days);
        expect(resolveRenewalReminderThreshold(endDate, '2026-07-31')).toBe(threshold);
    });

    it('uses date-only arithmetic without local timezone drift', () => {
        expect(daysUntilContractEnd('2026-03-29', '2026-03-28')).toBe(1);
    });
});

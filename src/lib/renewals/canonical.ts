export const RENEWAL_WINDOW_DAYS = 60 as const;
export const RENEWAL_REMINDER_THRESHOLDS = [60, 30, 7, 0] as const;

export type RenewalReminderThreshold = (typeof RENEWAL_REMINDER_THRESHOLDS)[number];

function dateOnlyToUtc(value: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error('Invalid date-only value');
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function daysUntilContractEnd(endDate: string, asOf: string): number {
    return Math.floor((dateOnlyToUtc(endDate) - dateOnlyToUtc(asOf)) / 86_400_000);
}

export function resolveRenewalReminderThreshold(
    endDate: string,
    asOf: string,
): RenewalReminderThreshold | null {
    const daysRemaining = daysUntilContractEnd(endDate, asOf);
    if (daysRemaining > RENEWAL_WINDOW_DAYS) return null;
    if (daysRemaining <= 0) return 0;
    if (daysRemaining <= 7) return 7;
    if (daysRemaining <= 30) return 30;
    return 60;
}

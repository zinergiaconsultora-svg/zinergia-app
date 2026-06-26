/**
 * Business-day arithmetic for the ATR alta SLA clock.
 * Counts working days excluding weekends and Spanish NATIONAL fixed holidays.
 *
 * Note: regional/local holidays are not included — for an SLA estimate the
 * national set is a reasonable conservative approximation. Easter-based movable
 * feasts are intentionally omitted (they vary yearly); the fixed set below
 * covers the bulk of the calendar.
 */

// Fixed-date Spanish national holidays as MM-DD (Easter-dependent ones excluded)
const NATIONAL_FIXED_HOLIDAYS = new Set<string>([
    '01-01', // Año Nuevo
    '01-06', // Reyes
    '05-01', // Día del Trabajo
    '08-15', // Asunción
    '10-12', // Fiesta Nacional
    '11-01', // Todos los Santos
    '12-06', // Constitución
    '12-08', // Inmaculada
    '12-25', // Navidad
]);

function isHoliday(d: Date): boolean {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return NATIONAL_FIXED_HOLIDAYS.has(`${mm}-${dd}`);
}

function isWorkingDay(d: Date): boolean {
    const day = d.getDay();
    return day !== 0 && day !== 6 && !isHoliday(d);
}

/** Working days elapsed between an ISO date and now (excludes weekends + national holidays). */
export function businessDaysSince(isoDate: string): number {
    const start = new Date(isoDate);
    const end = new Date();
    if (start >= end) return 0;

    let count = 0;
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);

    while (cur < endDay) {
        cur.setDate(cur.getDate() + 1);
        if (isWorkingDay(cur)) count++;
    }
    return count;
}

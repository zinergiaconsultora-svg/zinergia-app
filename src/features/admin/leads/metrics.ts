/** Conversion rate as an integer percentage of closed leads (won / (won+lost)). */
export function conversionRate(won: number, lost: number): number {
    const closed = won + lost;
    if (closed <= 0) return 0;
    return Math.round((won / closed) * 100);
}

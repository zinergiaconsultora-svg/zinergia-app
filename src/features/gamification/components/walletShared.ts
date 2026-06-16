/** Mask an IBAN for display: keep first 4 + last 4, hide the middle. */
export function maskIban(iban: string): string {
    if (iban.length < 8) return iban;
    return iban.slice(0, 4) + '****' + iban.slice(-4);
}

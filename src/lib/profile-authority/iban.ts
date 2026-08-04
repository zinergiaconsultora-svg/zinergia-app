export function maskIbanForDisplay(iban: string | null | undefined): string | null {
    const normalized = iban?.replace(/\s/g, '').toUpperCase() ?? '';
    if (normalized.length < 8) return null;
    return `${normalized.slice(0, 2)}${'•'.repeat(normalized.length - 6)}${normalized.slice(-4)}`;
}

const LOGOS: Record<string, string> = {
    GANA: '/marketers/gana-energia-tight.jpeg',
    GANAENERGIA: '/marketers/gana-energia-tight.jpeg',
    LOGOS: '/marketers/logos-energia-light.jpeg',
    LOGOSENERGIA: '/marketers/logos-energia-light.jpeg',
    NATURGY: '/marketers/naturgy.jpeg',
    PLENITUDE: '/marketers/plenitude.jpeg',
};

// Unicode combining diacritical marks range
const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');

export function normalizeMarketerName(name?: string | null): string {
    return (name || '')
        .normalize('NFD')
        .replace(DIACRITICS_RE, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
}

export function getMarketerLogo(name?: string | null): string | null {
    return LOGOS[normalizeMarketerName(name)] ?? null;
}

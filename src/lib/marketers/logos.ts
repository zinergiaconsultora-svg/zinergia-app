const LOGOS: Record<string, string> = {
    GANAENERGIA: '/marketers/gana-energia-tight.jpeg',
    LOGOS: '/marketers/logos-energia-light.jpeg',
    LOGOSENERGIA: '/marketers/logos-energia-light.jpeg',
    NATURGY: '/marketers/naturgy.jpeg',
    PLENITUDE: '/marketers/plenitude.jpeg',
};

export function normalizeMarketerName(name?: string | null): string {
    return (name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
}

export function getMarketerLogo(name?: string | null): string | null {
    return LOGOS[normalizeMarketerName(name)] || null;
}

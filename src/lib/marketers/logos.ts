const LOGOS: Record<string, string> = {
    GANA: '/marketers/gana-energia-tight.jpeg',
    GANAENERGIA: '/marketers/gana-energia-tight.jpeg',
    LOGOS: '/marketers/logos-energia-light.jpeg',
    LOGOSENERGIA: '/marketers/logos-energia-light.jpeg',
    NATURGY: '/marketers/naturgy.jpeg',
    PLENITUDE: '/marketers/plenitude.jpeg',
};

export function normalizeMarketerName(name?: string | null): string {
    return (name || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
}

export function getMarketerLogo(name?: string | null): string | null {
    const normalized = normalizeMarketerName(name);
    return LOGOS[normalized] ||
        Object.entries(LOGOS).find(([key]) => normalized.includes(key) || key.includes(normalized))?.[1] ||
        null;
}

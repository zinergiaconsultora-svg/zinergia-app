const SENSITIVE_OCR_FIELDS = new Set([
    'address',
    'auth',
    'cif',
    'cif_nif',
    'client_name',
    'cliente_nombre',
    'cups',
    'cups_suministro',
    'direccion',
    'direccion_suministro',
    'dni',
    'dni_cif',
    'email',
    'nif',
    'nif_cif',
    'phone',
    'supply_address',
    'telefono',
    'titular',
]);

export function redactOcrTextSample(value: string): string {
    return value
        .replace(/\bES[0-9A-Z]{16,24}\b/gi, '[REDACTED_CUPS]')
        .replace(/\b[XYZ]?\d{7,8}[A-Z]\b/gi, '[REDACTED_ID]')
        .replace(/\b[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]\b/gi, '[REDACTED_ID]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
}

export function sanitizeOcrTrainingData(value: unknown): unknown {
    if (typeof value === 'string') return redactOcrTextSample(value);
    if (Array.isArray(value)) return value.map(sanitizeOcrTrainingData);
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
            const normalizedKey = key.toLowerCase();
            if (SENSITIVE_OCR_FIELDS.has(normalizedKey)) {
                return [key, '[REDACTED]'];
            }
            return [key, sanitizeOcrTrainingData(nestedValue)];
        }),
    );
}

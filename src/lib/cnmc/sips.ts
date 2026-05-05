import crypto from 'node:crypto';

export const CNMC_SIPS_BASE_URL = 'https://api.cnmc.gob.es/verticales/v1/SIPS/consulta/v1';

export type SipsFileType =
    | 'SIPS2_PS_ELECTRICIDAD'
    | 'SIPS2_CONSUMOS_ELECTRICIDAD'
    | 'SIPS2_PS_GAS'
    | 'SIPS2_CONSUMOS_GAS';

export interface CnmcOAuthConfig {
    consumerKey: string;
    consumerSecret: string;
    token: string;
    tokenSecret: string;
}

export interface SipsAnnualConsumption {
    cups: string;
    annualKwh: number;
    annualMwh: number;
    rows: number;
    source: 'CNMC_SIPS';
}

const ENERGY_CONSUMPTION_FIELDS = [
    'consumoEnergiaActivaEnWhP1',
    'consumoEnergiaActivaEnWhP2',
    'consumoEnergiaActivaEnWhP3',
    'consumoEnergiaActivaEnWhP4',
    'consumoEnergiaActivaEnWhP5',
    'consumoEnergiaActivaEnWhP6',
];

export function getCnmcOAuthConfig(): CnmcOAuthConfig {
    const config = {
        consumerKey: process.env.CNMC_OAUTH_CONSUMER_KEY,
        consumerSecret: process.env.CNMC_OAUTH_CONSUMER_SECRET,
        token: process.env.CNMC_OAUTH_TOKEN,
        tokenSecret: process.env.CNMC_OAUTH_TOKEN_SECRET,
    };

    const missing = Object.entries(config)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missing.length > 0) {
        throw new Error(`Missing CNMC OAuth environment variables: ${missing.join(', ')}`);
    }

    return config as CnmcOAuthConfig;
}

export function normalizeCups(cups: string): string {
    return cups.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidCups(cups: string): boolean {
    return /^ES[A-Z0-9]{18,22}$/.test(normalizeCups(cups));
}

export function buildSipsUrl(fileType: SipsFileType, cups: string): string {
    const url = new URL(`${CNMC_SIPS_BASE_URL}/${fileType}.csv`);
    url.searchParams.set('cups', normalizeCups(cups));
    return url.toString();
}

export async function fetchSipsCsv(fileType: SipsFileType, cups: string, config = getCnmcOAuthConfig()): Promise<string> {
    const url = buildSipsUrl(fileType, cups);
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: buildOAuthHeader('GET', url, config),
            Accept: 'text/csv, text/plain, */*',
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`CNMC SIPS request failed with status ${response.status}`);
    }

    return response.text();
}

export async function getElectricityAnnualConsumption(cups: string): Promise<SipsAnnualConsumption> {
    const normalized = normalizeCups(cups);
    if (!isValidCups(normalized)) {
        throw new Error('Invalid CUPS format');
    }

    const csv = await fetchSipsCsv('SIPS2_CONSUMOS_ELECTRICIDAD', normalized);
    return calculateElectricityAnnualConsumption(normalized, csv);
}

export function calculateElectricityAnnualConsumption(cups: string, csv: string): SipsAnnualConsumption {
    const rows = parseCsv(csv);
    const annualWh = rows.reduce((total, row) => {
        return total + ENERGY_CONSUMPTION_FIELDS.reduce((sum, field) => sum + parseSpanishNumber(row[field]), 0);
    }, 0);

    const annualKwh = annualWh / 1000;

    return {
        cups: normalizeCups(cups),
        annualKwh,
        annualMwh: annualKwh / 1000,
        rows: rows.length,
        source: 'CNMC_SIPS',
    };
}

export function parseCsv(csv: string): Array<Record<string, string>> {
    const lines = csv
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter(line => line.trim().length > 0);

    if (lines.length < 2) return [];

    const delimiter = detectDelimiter(lines[0]);
    const headers = splitCsvLine(lines[0], delimiter).map(header => header.trim());

    return lines.slice(1).map(line => {
        const values = splitCsvLine(line, delimiter);
        return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']));
    });
}

function detectDelimiter(headerLine: string): ',' | ';' {
    return headerLine.split(';').length >= headerLine.split(',').length ? ';' : ',';
}

function splitCsvLine(line: string, delimiter: ',' | ';'): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"' && next === '"') {
            current += '"';
            i += 1;
            continue;
        }

        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }

        if (char === delimiter && !inQuotes) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);
    return values;
}

function parseSpanishNumber(value: string | undefined): number {
    if (!value) return 0;
    const clean = value.trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : 0;
}

function buildOAuthHeader(method: 'GET', url: string, config: CnmcOAuthConfig): string {
    const oauthParams: Record<string, string> = {
        oauth_consumer_key: config.consumerKey,
        oauth_token: config.token,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version: '1.0',
    };

    const signature = signOAuthRequest(method, url, oauthParams, config);
    return `OAuth ${Object.entries({ ...oauthParams, oauth_signature: signature })
        .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
        .join(', ')}`;
}

function signOAuthRequest(method: string, url: string, oauthParams: Record<string, string>, config: CnmcOAuthConfig): string {
    const parsedUrl = new URL(url);
    const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());
    const signatureParams = { ...queryParams, ...oauthParams };
    const normalizedParams = Object.entries(signatureParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
        .join('&');

    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
    const signatureBase = [
        method.toUpperCase(),
        percentEncode(baseUrl),
        percentEncode(normalizedParams),
    ].join('&');
    const signingKey = `${percentEncode(config.consumerSecret)}&${percentEncode(config.tokenSecret)}`;

    return crypto
        .createHmac('sha1', signingKey)
        .update(signatureBase)
        .digest('base64');
}

function percentEncode(value: string): string {
    return encodeURIComponent(value)
        .replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

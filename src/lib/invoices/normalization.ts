import type { InvoiceData } from '@/types/crm';

export type SimulatorPowerType = '2.0' | '3.0' | '3.1';
export type InvoicePeriod = 1 | 2 | 3 | 4 | 5 | 6;

const PERIODS: InvoicePeriod[] = [1, 2, 3, 4, 5, 6];

export interface InvoiceNormalizationResult {
    invoice: InvoiceData;
    alerts: string[];
    corrections: Record<string, { from: unknown; to: unknown; reason: string }>;
}

export function parseInvoiceNumber(value: unknown): number {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    const strValue = String(value)
        .trim()
        .replace(/\s/g, '')
        .replace(/[€]|kwh|kw|dias?|días?/gi, '');

    if (!strValue) return 0;
    if (strValue.includes('.') && strValue.includes(',')) {
        return parseFloat(strValue.replace(/\./g, '').replace(',', '.')) || 0;
    }
    if (strValue.includes(',')) return parseFloat(strValue.replace(',', '.')) || 0;
    return parseFloat(strValue) || 0;
}

export function inferInvoicePowerType(invoice: Partial<InvoiceData>): SimulatorPowerType {
    const hint = [
        invoice.detected_power_type,
        invoice.detected_tariff_type,
        invoice.tariff_name,
        invoice.forensic_details?.tariff_access,
    ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase();

    if (hint.includes('6.1') || hint.includes('6.2') || hint.includes('3.1')) return '3.1';
    if (hint.includes('3.0')) return '3.0';

    const hasP456 = PERIODS.slice(3).some(period =>
        getPeriodValue(invoice, 'power', period) > 0 || getPeriodValue(invoice, 'energy', period) > 0
    );
    if (hasP456) return '3.0';

    const maxPower = Math.max(...PERIODS.map(period => getPeriodValue(invoice, 'power', period)));
    if (maxPower > 15) return '3.0';

    const hasP3Power = getPeriodValue(invoice, 'power', 3) > 0;
    if (hasP3Power) return '3.0';

    return '2.0';
}

export function getVisibleInvoicePeriods(
    invoice: Partial<InvoiceData>,
    type: SimulatorPowerType | string,
): { energy: InvoicePeriod[]; power: InvoicePeriod[] } {
    const typed = normalizeSimulatorPowerType(type);
    const hasValue = (kind: 'power' | 'energy', period: InvoicePeriod) => getPeriodValue(invoice, kind, period) > 0;

    return {
        energy: PERIODS.filter(period => typed !== '2.0' || period <= 3 || hasValue('energy', period)),
        power: PERIODS.filter(period => typed !== '2.0' || period <= 2 || hasValue('power', period)),
    };
}

export function normalizeInvoiceData(
    input: Partial<InvoiceData> & Record<string, unknown>,
    options: { rawText?: string | null } = {},
): InvoiceNormalizationResult {
    const alerts: string[] = [];
    const corrections: InvoiceNormalizationResult['corrections'] = {};
    const invoice = { ...input } as InvoiceData & Record<string, unknown>;

    for (const period of PERIODS) {
        invoice[`power_p${period}`] = parseInvoiceNumber(invoice[`power_p${period}`]);
        invoice[`energy_p${period}`] = parseInvoiceNumber(invoice[`energy_p${period}`]);
        invoice[`current_power_price_p${period}`] = normalizeOptionalNumber(invoice[`current_power_price_p${period}`]);
        invoice[`current_energy_price_p${period}`] = normalizeOptionalNumber(invoice[`current_energy_price_p${period}`]);
    }
    invoice.period_days = parseInvoiceNumber(invoice.period_days) || 30;

    const parsed = options.rawText ? parseInvoiceTextByBlocks(options.rawText) : null;
    if (parsed) {
        applyParsedPeriods(invoice, parsed.power, 'power', corrections);
        applyParsedPeriods(invoice, parsed.energy, 'energy', corrections);
        applyParsedPrices(invoice, parsed.powerPrices, 'current_power_price', corrections);
        applyParsedPrices(invoice, parsed.energyPrices, 'current_energy_price', corrections);
        applyParsedFinancials(invoice, parsed.financials, corrections);

        if (parsed.days && parsed.days !== invoice.period_days) {
            corrections.period_days = {
                from: invoice.period_days,
                to: parsed.days,
                reason: 'dias extraidos del bloque de termino de potencia',
            };
            invoice.period_days = parsed.days;
        }
    }

    const inferredType = inferInvoicePowerType(invoice);
    const originalType = normalizeSimulatorPowerType(invoice.detected_power_type);
    if (originalType !== inferredType) {
        corrections.detected_power_type = {
            from: invoice.detected_power_type,
            to: inferredType,
            reason: 'clasificacion corregida por periodos P1-P6, potencia contratada o texto tarifario',
        };
        invoice.detected_power_type = inferredType;
    } else {
        invoice.detected_power_type = inferredType;
    }

    alerts.push(...validateNormalizedInvoice(invoice));

    return { invoice, alerts, corrections };
}

export function validateNormalizedInvoice(invoice: Partial<InvoiceData>): string[] {
    const alerts: string[] = [];
    const type = inferInvoicePowerType(invoice);
    const hasP6Energy = getPeriodValue(invoice, 'energy', 6) > 0;
    const hasAnyP456 = PERIODS.slice(3).some(period =>
        getPeriodValue(invoice, 'power', period) > 0 || getPeriodValue(invoice, 'energy', period) > 0
    );
    const missingPymePower = type !== '2.0'
        ? PERIODS.filter(period => getPeriodValue(invoice, 'power', period) <= 0)
        : [];

    if (type === '2.0' && hasAnyP456) {
        alerts.push('La factura contiene datos en P4-P6 y no debe tratarse como 2.0TD.');
    }
    if (type !== '2.0' && missingPymePower.length > 0) {
        alerts.push(`Factura ${type === '3.1' ? '6.1TD/3.1TD' : '3.0TD'} con potencia incompleta en ${missingPymePower.map(p => `P${p}`).join(', ')}.`);
    }
    if (type !== '2.0' && !hasP6Energy && getPeriodValue(invoice, 'energy', 2) + getPeriodValue(invoice, 'energy', 3) > 0) {
        alerts.push('Factura de seis periodos sin energia P6 detectada. Revisar si el OCR ha omitido el periodo valle.');
    }
    if (!invoice.period_days || invoice.period_days <= 0) {
        alerts.push('No hay dias de facturacion validos.');
    }

    return alerts;
}

function parseInvoiceTextByBlocks(rawText: string) {
    const text = rawText.replace(/\r/g, '\n');
    const powerBlock = getBlock(text, [
        /t[eé]rmino\s+(de\s+)?potencia/i,
        /potencia\s+tarifa/i,
    ], [
        /t[eé]rmino\s+(de\s+)?energ/i,
        /energ[ií]a\s+consumida/i,
        /potencias\s+m[aá]ximas/i,
        /lecturas/i,
    ]);
    const energyBlock = getBlock(text, [
        /t[eé]rmino\s+(de\s+)?energ/i,
        /energ[ií]a\s+consumida/i,
        /energ[ií]a\s+facturada/i,
    ], [
        /autoconsumo/i,
        /compensaci[oó]n/i,
        /lecturas/i,
        /potencias\s+m[aá]ximas/i,
        /impuesto/i,
        /alquiler/i,
    ]);

    const power = parsePeriodQuantityRows(powerBlock, 'kw');
    const energy = parsePeriodQuantityRows(energyBlock, 'kwh');
    const powerPrices = parsePeriodPrices(powerBlock, 'kw');
    const energyPrices = parsePeriodPrices(energyBlock, 'kwh');
    const days = getMostCommonDays(powerBlock);
    const financials = parseFinancialDetails(text);

    if (!powerBlock && !energyBlock && Object.values(financials).every(value => !value || value <= 0)) return null;
    return { power, energy, powerPrices, energyPrices, days, financials };
}

function getBlock(text: string, starts: RegExp[], stops: RegExp[]): string {
    const lines = text.split('\n');
    const startIndex = lines.findIndex(line => starts.some(pattern => pattern.test(line)));
    if (startIndex < 0) return '';

    const endIndex = lines.findIndex((line, index) => index > startIndex && stops.some(pattern => pattern.test(line)));
    return lines.slice(startIndex, endIndex > startIndex ? endIndex : Math.min(lines.length, startIndex + 40)).join('\n');
}

function parsePeriodQuantityRows(block: string, unit: 'kw' | 'kwh'): Partial<Record<InvoicePeriod, number>> {
    const values: Partial<Record<InvoicePeriod, number>> = {};
    if (!block) return values;

    const regex = new RegExp(`P\\s*([1-6])\\s+([0-9.,]+)\\s*${unit}\\b`, 'gi');
    for (const match of block.matchAll(regex)) {
        const period = Number(match[1]) as InvoicePeriod;
        const value = parseInvoiceNumber(match[2]);
        if (value > 0) values[period] = value;
    }
    return values;
}

function parsePeriodPrices(block: string, unit: 'kw' | 'kwh'): Partial<Record<InvoicePeriod, number>> {
    const values: Partial<Record<InvoicePeriod, number>> = {};
    if (!block) return values;

    const regex = new RegExp(`P\\s*([1-6])\\s+[0-9.,]+\\s*${unit}\\b\\s*x(?:\\s*[0-9.,]+\\s*d[ií]as?\\s*x)?\\s*([0-9.,]+)`, 'gi');
    for (const match of block.matchAll(regex)) {
        const period = Number(match[1]) as InvoicePeriod;
        const value = parseInvoiceNumber(match[2]);
        if (value > 0) values[period] = value;
    }
    return values;
}

function getMostCommonDays(block: string): number | null {
    const matches = [...block.matchAll(/\bx\s*([0-9.,]+)\s*d[ií]as?\s*x/gi)]
        .map(match => parseInvoiceNumber(match[1]))
        .filter(value => value > 0);
    if (matches.length === 0) return null;

    const counts = new Map<number, number>();
    for (const value of matches) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function applyParsedPeriods(
    invoice: InvoiceData & Record<string, unknown>,
    parsed: Partial<Record<InvoicePeriod, number>>,
    kind: 'power' | 'energy',
    corrections: InvoiceNormalizationResult['corrections'],
) {
    for (const [periodText, value] of Object.entries(parsed)) {
        const key = `${kind}_p${periodText}`;
        const current = parseInvoiceNumber(invoice[key]);
        if ((!current || current <= 0) && value && value > 0) {
            corrections[key] = { from: invoice[key], to: value, reason: 'recuperado desde bloque facturado del texto OCR' };
            invoice[key] = value;
        }
    }
}

function applyParsedPrices(
    invoice: InvoiceData & Record<string, unknown>,
    parsed: Partial<Record<InvoicePeriod, number>>,
    prefix: 'current_power_price' | 'current_energy_price',
    corrections: InvoiceNormalizationResult['corrections'],
) {
    for (const [periodText, value] of Object.entries(parsed)) {
        const key = `${prefix}_p${periodText}`;
        const current = parseInvoiceNumber(invoice[key]);
        if ((!current || current <= 0) && value && value > 0) {
            corrections[key] = { from: invoice[key], to: value, reason: 'precio recuperado desde bloque facturado del texto OCR' };
            invoice[key] = value;
        }
    }
}

function applyParsedFinancials(
    invoice: InvoiceData & Record<string, unknown>,
    parsed: Partial<Record<keyof InvoiceData, number>>,
    corrections: InvoiceNormalizationResult['corrections'],
) {
    for (const [key, value] of Object.entries(parsed)) {
        if (!value || value <= 0) continue;
        const current = parseInvoiceNumber(invoice[key]);
        if (!current || current <= 0) {
            corrections[key] = { from: invoice[key], to: value, reason: 'importe recuperado desde texto OCR de la factura' };
            invoice[key] = value;
        }
    }
}

function getPeriodValue(invoice: Partial<InvoiceData>, kind: 'power' | 'energy', period: InvoicePeriod): number {
    return parseInvoiceNumber(invoice[`${kind}_p${period}` as keyof InvoiceData]);
}

function normalizeOptionalNumber(value: unknown): number | undefined {
    const parsed = parseInvoiceNumber(value);
    return parsed > 0 ? parsed : undefined;
}

function normalizeSimulatorPowerType(value: unknown): SimulatorPowerType {
    const normalized = String(value || '').toUpperCase();
    if (normalized.includes('6.1') || normalized.includes('6.2') || normalized.includes('3.1')) return '3.1';
    if (normalized.includes('3.0')) return '3.0';
    return '2.0';
}

function parseFinancialDetails(text: string): Partial<Record<keyof InvoiceData, number>> {
    const normalized = text.replace(/\r/g, '\n');
    const servicesAmount = parseCommercialServicesAmount(normalized);
    const surplusExportKwh = parseSurplusExportKwh(normalized);
    const annualConsumptionKwh = findFirstNumber(normalized, [
        /consumo\s+(?:acumulado|anual)[^\n]{0,80}?([0-9][0-9.,]*)\s*kwh/i,
        /(?:ultimos|últimos)\s+12\s+meses[^\n]{0,80}?([0-9][0-9.,]*)\s*kwh/i,
        /ultimo\s+a[nñ]o[^\n]{0,80}?([0-9][0-9.,]*)\s*kwh/i,
    ], { thousandsLikely: true });

    return {
        bono_social: findAmount(normalized, [
            /(?:financiaci[oó]n\s+)?bono\s+social/i,
        ]),
        rental_cost: findAmount(normalized, [
            /alquiler\s+(?:de\s+)?(?:equipos?|contador|medida)/i,
            /equipo[s]?\s+de\s+medida/i,
        ]),
        distribution_excess_cost: findAmount(normalized, [
            /excesos?\s+(?:de\s+)?(?:potencia|distribuidora)/i,
            /t[eé]rmino\s+de\s+exceso/i,
        ]),
        reactive_energy_cost: findAmount(normalized, [
            /energ[ií]a\s+reactiva/i,
            /reactiva\s+facturada/i,
        ]),
        excluded_services_cost: servicesAmount,
        surplus_export_kwh: surplusExportKwh,
        annual_consumption_kwh: annualConsumptionKwh,
        electricity_tax_percent: findPercent(normalized, [
            /impuesto\s+(?:sobre\s+)?(?:la\s+)?electricidad/i,
            /impuesto\s+el[eé]ctrico/i,
        ]),
        vat_percent: findPercent(normalized, [
            /\biva\b/i,
        ]),
    };
}

function findAmount(text: string, labels: RegExp[]): number | undefined {
    for (const line of text.split('\n')) {
        if (!labels.some(label => label.test(line))) continue;
        const amount = getLastEuroAmount(line);
        if (amount !== undefined) return Math.abs(amount);
    }
    return undefined;
}

function findPercent(text: string, labels: RegExp[]): number | undefined {
    for (const line of text.split('\n')) {
        if (!labels.some(label => label.test(line))) continue;
        const match = line.match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
        if (match) return parseInvoiceNumber(match[1]);
    }
    return undefined;
}

function findFirstNumber(text: string, patterns: RegExp[], options: { thousandsLikely?: boolean } = {}): number | undefined {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = options.thousandsLikely ? parseLikelyInteger(match[1]) : parseInvoiceNumber(match[1]);
            if (value > 0) return value;
        }
    }
    return undefined;
}

function parseLikelyInteger(value: string): number {
    const normalized = value.trim();
    if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
        return parseInvoiceNumber(normalized.replace(/\./g, ''));
    }
    return parseInvoiceNumber(normalized);
}

function getLastEuroAmount(line: string): number | undefined {
    const matches = [...line.matchAll(/(-?[0-9][0-9.,]*)\s*€/g)];
    const last = matches.at(-1);
    if (!last) return undefined;
    const value = parseInvoiceNumber(last[1]);
    return Number.isFinite(value) ? value : undefined;
}

function parseCommercialServicesAmount(text: string): number | undefined {
    const serviceLabels = /(?:goclean|mantenimiento|servicio|asistencia|gesti[oó]n|energia\s+limpia|energ[ií]a\s+limpia)/i;
    const mandatoryLabels = /(?:bono\s+social|alquiler|reactiva|exceso|impuesto|iva|peaje|cargo|potencia|energ[ií]a\s+consumida)/i;
    let total = 0;

    for (const line of text.split('\n')) {
        if (!serviceLabels.test(line) || mandatoryLabels.test(line)) continue;
        const amount = getLastEuroAmount(line);
        if (amount !== undefined) total += amount;
    }

    return Math.abs(total) > 0.005 ? Math.abs(total) : undefined;
}

function parseSurplusExportKwh(text: string): number | undefined {
    const block = getBlock(text, [
        /autoconsumo/i,
        /compensaci[oó]n\s+(?:de\s+)?excedentes/i,
        /excedentes\s+autoconsumo/i,
    ], [
        /lecturas/i,
        /potencias\s+m[aá]ximas/i,
        /impuesto/i,
        /alquiler/i,
        /total/i,
    ]);
    if (!block) return undefined;

    const values = [...block.matchAll(/P\s*[1-6]\s+([0-9][0-9.,]*)\s*kWh\b/gi)]
        .map(match => parseInvoiceNumber(match[1]))
        .filter(value => value > 0);

    const total = values.reduce((sum, value) => sum + value, 0);
    return total > 0 ? total : undefined;
}

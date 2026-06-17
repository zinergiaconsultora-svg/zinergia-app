import type { InvoiceData } from '@/types/crm';

/**
 * Campos obligatorios para una comparativa válida. Sin todos ellos no se
 * permite ejecutar la comparación (se bloquea, no sólo se avisa).
 *
 * Nota: el DNI/CIF debe ser el del TITULAR de la factura, no el de la
 * comercializadora. La distinción de extracción se aborda aparte; aquí sólo
 * se exige su presencia.
 */
export function getMissingCriticalFields(data: InvoiceData): string[] {
    const cupsValid = data.cups?.length === 20 || data.cups?.length === 22;
    const hasPower = [1, 2, 3, 4, 5, 6].some(p => (data[`power_p${p}` as keyof InvoiceData] as number) > 0);
    const hasEnergy = [1, 2, 3, 4, 5, 6].some(p => (data[`energy_p${p}` as keyof InvoiceData] as number) > 0);
    const hasDays = (data.period_days ?? 0) > 0;
    const hasDni = !!data.dni_cif?.trim();

    const missing: string[] = [];
    if (!cupsValid) missing.push('CUPS');
    if (!hasPower) missing.push('potencia contratada');
    if (!hasEnergy) missing.push('consumo');
    if (!hasDays) missing.push('días facturados');
    if (!hasDni) missing.push('DNI/CIF del titular');
    return missing;
}

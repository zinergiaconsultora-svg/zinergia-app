export type PlenitudeCommissionTariffType = '3.0TD' | '6.1TD';
export type PlenitudeCommissionGroup =
    | 'POWER_PLUS_ENERGY_PLUS'
    | 'FACIL_POWER_PLUS_FACIL_ENERGY_PLUS'
    | 'POWER_ENERGY'
    | 'FACIL_POWER_FACIL_ENERGY'
    | 'FACIL_PRIME';

export interface PlenitudeCommissionBand {
    tariffType: PlenitudeCommissionTariffType;
    group: PlenitudeCommissionGroup;
    minMwh: number;
    maxMwh: number | null;
    commissionEur: number;
}

const RANGES: Array<[number, number | null]> = [
    [0, 1],
    [1, 2],
    [2, 5],
    [5, 10],
    [10, 20],
    [20, 30],
    [30, 40],
    [40, 50],
    [50, 70],
    [70, 100],
    [100, 150],
    [150, 200],
    [200, 300],
    [300, 400],
    [400, 500],
    [500, 700],
    [700, 1200],
    [1200, null],
];

const bands = (
    tariffType: PlenitudeCommissionTariffType,
    group: PlenitudeCommissionGroup,
    values: number[],
): PlenitudeCommissionBand[] =>
    values.map((commissionEur, index) => ({
        tariffType,
        group,
        minMwh: RANGES[index][0],
        maxMwh: RANGES[index][1],
        commissionEur,
    }));

export const PLENITUDE_COMMISSION_BANDS: PlenitudeCommissionBand[] = [
    ...bands('3.0TD', 'POWER_PLUS_ENERGY_PLUS', [
        151.20, 156.80, 162.40, 252.80, 406.40, 625.60, 684.80, 764.80, 950.40,
        1339.20, 2080.80, 2967.20, 4149.60, 5912.00, 7071.20, 9389.60, 14026.40, 21445.60,
    ]),
    ...bands('3.0TD', 'FACIL_POWER_PLUS_FACIL_ENERGY_PLUS', [
        156.80, 156.80, 156.80, 156.80, 198.40, 272.00, 318.40, 364.00, 456.00,
        732.00, 824.00, 1100.00, 1468.00, 2020.00, 2572.00, 2940.00, 3492.00, 3676.00,
    ]),
    ...bands('3.0TD', 'POWER_ENERGY', [
        66.40, 80.00, 96.00, 126.40, 188.80, 289.60, 377.60, 473.60, 575.20,
        787.20, 922.40, 1313.60, 1835.20, 2627.20, 3448.80, 4540.00, 6376.00, 11108.80,
    ]),
    ...bands('3.0TD', 'FACIL_POWER_FACIL_ENERGY', [
        110.40, 110.40, 110.40, 110.40, 134.40, 161.60, 198.40, 272.00, 364.00,
        456.00, 548.00, 686.40, 778.40, 916.00, 1376.00, 2020.00, 2296.00, 2756.00,
    ]),
    ...bands('3.0TD', 'FACIL_PRIME', [
        138.40, 138.40, 138.40, 138.40, 152.80, 198.40, 272.00, 318.40, 410.40,
        640.00, 732.00, 916.00, 1284.00, 1836.00, 2296.00, 2756.00, 2940.00, 3216.00,
    ]),
    ...bands('6.1TD', 'POWER_PLUS_ENERGY_PLUS', [
        131.20, 136.00, 140.80, 220.00, 353.60, 544.00, 595.20, 665.60, 826.40,
        1164.80, 1809.60, 2580.80, 3608.80, 5140.80, 6148.80, 8164.80, 12196.80, 18648.00,
    ]),
    ...bands('6.1TD', 'POWER_ENERGY', [
        57.96, 69.72, 83.16, 109.20, 163.80, 252.00, 327.60, 411.60, 499.80,
        684.60, 802.20, 1142.40, 1596.00, 2284.80, 2998.80, 3948.00, 5544.00, 9660.00,
    ]),
];

export function resolvePlenitudeCommissionGroup(
    tariffType: string,
    product: string | null | undefined,
    tariffName: string,
): PlenitudeCommissionGroup | null {
    const normalizedType = normalizeTariffType(tariffType);
    const normalizedProduct = normalize(product);
    const normalizedName = normalize(tariffName);

    if (normalizedType === '3.0TD' && normalizedProduct === 'FACIL' && normalizedName === 'PRIME') {
        return 'FACIL_PRIME';
    }

    if (isPowerPlusOrEnergyPlus(normalizedName)) {
        return normalizedProduct === 'FACIL'
            ? 'FACIL_POWER_PLUS_FACIL_ENERGY_PLUS'
            : 'POWER_PLUS_ENERGY_PLUS';
    }

    if (isPowerOrEnergy(normalizedName)) {
        return normalizedProduct === 'FACIL'
            ? 'FACIL_POWER_FACIL_ENERGY'
            : 'POWER_ENERGY';
    }

    return null;
}

export function calculatePlenitudeCommission(
    tariffType: string,
    product: string | null | undefined,
    tariffName: string,
    annualMwh: number,
): PlenitudeCommissionBand | null {
    const normalizedType = normalizeTariffType(tariffType);
    const group = resolvePlenitudeCommissionGroup(normalizedType, product, tariffName);
    if (!group || annualMwh < 0) return null;

    return PLENITUDE_COMMISSION_BANDS.find(band =>
        band.tariffType === normalizedType &&
        band.group === group &&
        annualMwh >= band.minMwh &&
        (band.maxMwh === null || annualMwh < band.maxMwh)
    ) ?? null;
}

function normalizeTariffType(value: string): PlenitudeCommissionTariffType | string {
    const normalized = normalize(value);
    if (normalized.includes('6.1')) return '6.1TD';
    if (normalized.includes('3.0')) return '3.0TD';
    return normalized;
}

function isPowerPlusOrEnergyPlus(value: string): boolean {
    const compact = value.replace(/\s+/g, '');
    return compact === 'POWER+' || value === 'POWER PLUS' || compact === 'ENERGY+' || value === 'ENERGY PLUS';
}

function isPowerOrEnergy(value: string): boolean {
    return value === 'POWER' || value === 'ENERGY';
}

function normalize(value: string | null | undefined): string {
    return (value ?? '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

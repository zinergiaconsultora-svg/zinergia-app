import type { TariffCandidate, TariffPeriod } from '@/lib/aletheia/types';

export type PlenitudeProduct = 'FACIL' | 'PERIODOS' | 'FIJO';

export interface PlenitudeElectricityTariff {
    company: 'Plenitude';
    product: PlenitudeProduct;
    tariffName: string;
    tariffType: '3.0TD' | '6.1TD';
    powerPrice: Record<TariffPeriod, number>;
    energyPrice: Record<TariffPeriod, number>;
    energySource: '15% dto' | 'sin dto';
}

const PERIODS: TariffPeriod[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

const prices = (p1: number, p2: number, p3: number, p4: number, p5: number, p6: number): Record<TariffPeriod, number> => ({
    p1, p2, p3, p4, p5, p6,
});

const flatEnergy = (price: number): Record<TariffPeriod, number> =>
    Object.fromEntries(PERIODS.map(period => [period, price])) as Record<TariffPeriod, number>;

const p30Base = prices(0.055827, 0.029089, 0.012278, 0.010647, 0.006887, 0.003951);
const p61Base = prices(0.081083, 0.042506, 0.018635, 0.014777, 0.005822, 0.002751);

export const PLENITUDE_ELECTRICITY_TARIFFS: PlenitudeElectricityTariff[] = [
    {
        company: 'Plenitude',
        product: 'FACIL',
        tariffName: 'POWER +',
        tariffType: '3.0TD',
        powerPrice: p30Base,
        energyPrice: flatEnergy(0.162381),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FACIL',
        tariffName: 'POWER',
        tariffType: '3.0TD',
        powerPrice: p30Base,
        energyPrice: flatEnergy(0.157306),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FACIL',
        tariffName: 'ENERGY +',
        tariffType: '3.0TD',
        powerPrice: prices(0.055827, 0.029089, 0.026182, 0.024551, 0.026353, 0.023417),
        energyPrice: flatEnergy(0.138021),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FACIL',
        tariffName: 'ENERGY',
        tariffType: '3.0TD',
        powerPrice: prices(0.055827, 0.029089, 0.023401, 0.021770, 0.020791, 0.017855),
        energyPrice: flatEnergy(0.138021),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FACIL',
        tariffName: 'PRIME',
        tariffType: '3.0TD',
        powerPrice: prices(0.055827, 0.029089, 0.017839, 0.016209, 0.020791, 0.017855),
        energyPrice: flatEnergy(0.145126),
        energySource: 'sin dto',
    },
    {
        company: 'Plenitude',
        product: 'PERIODOS',
        tariffName: 'POWER +',
        tariffType: '3.0TD',
        powerPrice: p30Base,
        energyPrice: prices(0.246066, 0.212546, 0.184761, 0.162663, 0.140641, 0.154914),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'PERIODOS',
        tariffName: 'POWER',
        tariffType: '3.0TD',
        powerPrice: p30Base,
        energyPrice: prices(0.231856, 0.198336, 0.170551, 0.148453, 0.126431, 0.140704),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'PERIODOS',
        tariffName: 'ENERGY +',
        tariffType: '3.0TD',
        powerPrice: prices(0.058608, 0.034651, 0.023401, 0.024551, 0.026353, 0.026198),
        energyPrice: prices(0.227796, 0.194276, 0.166491, 0.144393, 0.122371, 0.136644),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'PERIODOS',
        tariffName: 'ENERGY',
        tariffType: '3.0TD',
        powerPrice: prices(0.055827, 0.029089, 0.023401, 0.021770, 0.020791, 0.017855),
        energyPrice: prices(0.220691, 0.187171, 0.159386, 0.137288, 0.115266, 0.129539),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'PERIODOS',
        tariffName: 'BASSIC',
        tariffType: '3.0TD',
        powerPrice: p30Base,
        energyPrice: prices(0.207466, 0.173946, 0.146161, 0.124063, 0.102041, 0.116314),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'PERIODOS',
        tariffName: 'BASSIC 24M',
        tariffType: '3.0TD',
        powerPrice: prices(0.055827, 0.029089, 0.012278, 0.010647, 0.007721, 0.004785),
        energyPrice: prices(0.196528, 0.164181, 0.135233, 0.113428, 0.099302, 0.103139),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'PERIODOS',
        tariffName: 'BASSIC 36M',
        tariffType: '3.0TD',
        powerPrice: p30Base,
        energyPrice: prices(0.176544, 0.148434, 0.125652, 0.112824, 0.101523, 0.102976),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'PERIODOS',
        tariffName: 'BASSIC 60M',
        tariffType: '3.0TD',
        powerPrice: p30Base,
        energyPrice: prices(0.174514, 0.146404, 0.123622, 0.110794, 0.099493, 0.100946),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'PERIODOS',
        tariffName: 'CUSTOM 80',
        tariffType: '3.0TD',
        powerPrice: prices(0.055827, 0.029089, 0.023401, 0.021770, 0.020791, 0.017855),
        energyPrice: prices(0.207466, 0.173946, 0.146161, 0.124063, 0.102041, 0.116314),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'PERIODOS',
        tariffName: 'CUSTOM 100',
        tariffType: '3.0TD',
        powerPrice: prices(0.055827, 0.029089, 0.031743, 0.030113, 0.029133, 0.026198),
        energyPrice: prices(0.207466, 0.173946, 0.146161, 0.124063, 0.102041, 0.116314),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FIJO',
        tariffName: 'POWER +',
        tariffType: '6.1TD',
        powerPrice: p61Base,
        energyPrice: prices(0.201976, 0.174609, 0.155214, 0.136801, 0.117616, 0.127205),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FIJO',
        tariffName: 'POWER',
        tariffType: '6.1TD',
        powerPrice: p61Base,
        energyPrice: prices(0.190811, 0.163444, 0.144049, 0.125636, 0.106451, 0.116040),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FIJO',
        tariffName: 'ENERGY +',
        tariffType: '6.1TD',
        powerPrice: prices(0.083864, 0.048067, 0.029758, 0.028681, 0.025287, 0.024997),
        energyPrice: prices(0.190811, 0.163444, 0.144049, 0.125636, 0.106451, 0.116040),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FIJO',
        tariffName: 'ENERGY',
        tariffType: '6.1TD',
        powerPrice: prices(0.081083, 0.042506, 0.029758, 0.025900, 0.019726, 0.016655),
        energyPrice: prices(0.183706, 0.156339, 0.136944, 0.118531, 0.099346, 0.108935),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FIJO',
        tariffName: 'BASSIC',
        tariffType: '6.1TD',
        powerPrice: p61Base,
        energyPrice: prices(0.176571, 0.149204, 0.129809, 0.111396, 0.092211, 0.101800),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FIJO',
        tariffName: 'BASSIC 36M',
        tariffType: '6.1TD',
        powerPrice: p61Base,
        energyPrice: prices(0.146773, 0.124785, 0.110373, 0.100993, 0.090735, 0.091984),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FIJO',
        tariffName: 'BASSIC 60M',
        tariffType: '6.1TD',
        powerPrice: p61Base,
        energyPrice: prices(0.144743, 0.122755, 0.108343, 0.098963, 0.088705, 0.089954),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FIJO',
        tariffName: 'CUSTOM 80',
        tariffType: '6.1TD',
        powerPrice: prices(0.081083, 0.042506, 0.029758, 0.025900, 0.019726, 0.016655),
        energyPrice: prices(0.176571, 0.149204, 0.129809, 0.111396, 0.092211, 0.101800),
        energySource: '15% dto',
    },
    {
        company: 'Plenitude',
        product: 'FIJO',
        tariffName: 'CUSTOM 100',
        tariffType: '6.1TD',
        powerPrice: prices(0.081083, 0.042506, 0.038101, 0.034243, 0.028068, 0.024997),
        energyPrice: prices(0.176571, 0.149204, 0.129809, 0.111396, 0.092211, 0.101800),
        energySource: '15% dto',
    },
];

export function plenitudeToTariffCandidate(tariff: PlenitudeElectricityTariff): TariffCandidate {
    return {
        id: `plenitude-${tariff.product.toLowerCase()}-${tariff.tariffType.toLowerCase()}-${tariff.tariffName.toLowerCase().replaceAll(' ', '-')}`,
        name: tariff.tariffName,
        company: tariff.company,
        type: 'fixed',
        logo_color: 'bg-emerald-600',
        permanence_months: 0,
        power_price: tariff.powerPrice,
        energy_price: tariff.energyPrice,
        fixed_fee: 0,
    };
}

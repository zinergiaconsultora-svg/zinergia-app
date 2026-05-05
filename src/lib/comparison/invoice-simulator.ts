export type ComparisonPeriod = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';
export type TariffAccessType = '2.0TD' | '3.0TD' | '6.1TD' | string;
export type EnergyPricingMode = 'single' | 'periods';
export type QualityAlertLevel = 'info' | 'warning' | 'critical';

export type PeriodValues = Record<ComparisonPeriod, number>;

export interface InvoiceSimulationInput {
    days: number;
    tariffType?: TariffAccessType;
    cups?: string;
    contractedPowerKw: PeriodValues;
    energyKwh: PeriodValues;
    currentInvoiceTotal?: number;
    currentPowerCost?: number;
    currentEnergyCost?: number;
    bonoSocialAmount?: number;
    distributionExcessAmount?: number;
    reactiveEnergyAmount?: number;
    excludedServicesAmount?: number;
    surplusExportKwh?: number;
    meterRentalAmount?: number;
    electricityTaxRate?: number;
    vatRate?: number;
    hasSipsAnnualConsumption?: boolean;
}

export interface TariffSimulationInput {
    id: string;
    company: string;
    name: string;
    tariffType?: TariffAccessType;
    powerPrice: PeriodValues;
    energyPrice: PeriodValues;
    fixedFeeMonthly?: number;
    surplusCompensationPrice?: number;
}

export interface SimulationLine {
    label: string;
    amount: number;
    formula: string;
}

export interface QualityAlert {
    level: QualityAlertLevel;
    code: string;
    message: string;
}

export interface InvoiceSimulationResult {
    tariffId: string;
    tariffName: string;
    company: string;
    energyPricingMode: EnergyPricingMode;
    activePeriods: ComparisonPeriod[];
    lines: SimulationLine[];
    subtotalBeforeTax: number;
    electricityTax: number;
    taxableBase: number;
    vat: number;
    simulatedInvoiceTotal: number;
    currentInvoiceTotal: number;
    periodSavings: number;
    annualCost: number;
    annualSavings: number;
    savingsPercent: number;
    alerts: QualityAlert[];
}

const PERIODS: ComparisonPeriod[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const DEFAULT_ELECTRICITY_TAX_RATE = 0.0511269632;
const DEFAULT_VAT_RATE = 0.21;
const ACCOUNTING_MONTH_DAYS = 30.4167;
const MONEY_EPSILON = 0.005;

export function activePeriodsForTariffType(tariffType?: TariffAccessType): ComparisonPeriod[] {
    const normalized = (tariffType || '').toUpperCase();

    if (normalized.includes('2.0')) return ['p1', 'p2', 'p3'];
    return PERIODS;
}

export function detectEnergyPricingMode(energyPrice: PeriodValues, activePeriods: ComparisonPeriod[]): EnergyPricingMode {
    const nonZeroPrices = activePeriods
        .map(period => energyPrice[period] || 0)
        .filter(price => price > 0);

    if (nonZeroPrices.length <= 1) return 'single';

    const first = nonZeroPrices[0];
    return nonZeroPrices.every(price => Math.abs(price - first) < 0.000001) ? 'single' : 'periods';
}

export function simulateInvoiceComparison(
    invoice: InvoiceSimulationInput,
    tariff: TariffSimulationInput
): InvoiceSimulationResult {
    const days = Math.max(1, invoice.days || 0);
    const activePeriods = activePeriodsForTariffType(tariff.tariffType || invoice.tariffType);
    const energyPricingMode = detectEnergyPricingMode(tariff.energyPrice, activePeriods);
    const electricityTaxRate = invoice.electricityTaxRate ?? DEFAULT_ELECTRICITY_TAX_RATE;
    const vatRate = invoice.vatRate ?? DEFAULT_VAT_RATE;

    const powerCost = activePeriods.reduce((total, period) => {
        const kw = invoice.contractedPowerKw[period] || 0;
        const price = tariff.powerPrice[period] || 0;
        return total + kw * price * days;
    }, 0);

    const totalEnergyKwh = activePeriods.reduce((total, period) => total + (invoice.energyKwh[period] || 0), 0);
    const energyCost = energyPricingMode === 'single'
        ? totalEnergyKwh * getSingleEnergyPrice(tariff.energyPrice, activePeriods)
        : activePeriods.reduce((total, period) => {
            const kwh = invoice.energyKwh[period] || 0;
            const price = tariff.energyPrice[period] || 0;
            return total + kwh * price;
        }, 0);

    const fixedFee = ((tariff.fixedFeeMonthly || 0) / ACCOUNTING_MONTH_DAYS) * days;
    const bonoSocial = invoice.bonoSocialAmount || 0;
    const distributionExcess = invoice.distributionExcessAmount || 0;
    const reactiveEnergy = invoice.reactiveEnergyAmount || 0;
    const surplusCompensation = (invoice.surplusExportKwh || 0) * (tariff.surplusCompensationPrice || 0);
    const meterRental = invoice.meterRentalAmount || 0;

    const subtotalBeforeTax = powerCost + energyCost + fixedFee + bonoSocial + distributionExcess + reactiveEnergy - surplusCompensation;
    const electricityTax = subtotalBeforeTax * electricityTaxRate;
    const taxableBase = subtotalBeforeTax + electricityTax + meterRental;
    const vat = taxableBase * vatRate;
    const simulatedInvoiceTotal = taxableBase + vat;
    const currentInvoiceTotal = getCurrentInvoiceTotal(invoice, days);
    const periodSavings = currentInvoiceTotal - simulatedInvoiceTotal;
    const annualCost = (simulatedInvoiceTotal / days) * 365;
    const annualSavings = (periodSavings / days) * 365;
    const savingsPercent = currentInvoiceTotal > 0 ? (periodSavings / currentInvoiceTotal) * 100 : 0;

    return {
        tariffId: tariff.id,
        tariffName: tariff.name,
        company: tariff.company,
        energyPricingMode,
        activePeriods,
        lines: [
            {
                label: 'Potencia contratada',
                amount: powerCost,
                formula: 'Suma de kW contratados por periodo x precio potencia x dias facturados',
            },
            {
                label: 'Energia consumida',
                amount: energyCost,
                formula: energyPricingMode === 'single'
                    ? 'kWh totales x precio unico de energia'
                    : 'kWh de cada periodo x precio de energia del mismo periodo',
            },
            {
                label: 'Cuota fija comercializadora',
                amount: fixedFee,
                formula: 'Cuota mensual prorrateada por dias de factura',
            },
            {
                label: 'Financiacion bono social',
                amount: bonoSocial,
                formula: 'Importe copiado de la factura original',
            },
            {
                label: 'Excesos distribuidora',
                amount: distributionExcess,
                formula: 'Importe copiado de la factura original',
            },
            {
                label: 'Energia reactiva',
                amount: reactiveEnergy,
                formula: 'Importe copiado de la factura original y marcado como alerta tecnica',
            },
            {
                label: 'Compensacion excedentes',
                amount: -surplusCompensation,
                formula: tariff.surplusCompensationPrice
                    ? 'kWh excedentarios x precio compensacion de la comercializadora'
                    : 'Pendiente de configurar precio de compensacion por comercializadora',
            },
            {
                label: 'Alquiler equipo de medida',
                amount: meterRental,
                formula: 'Importe copiado de la factura original',
            },
        ],
        subtotalBeforeTax,
        electricityTax,
        taxableBase,
        vat,
        simulatedInvoiceTotal,
        currentInvoiceTotal,
        periodSavings,
        annualCost,
        annualSavings,
        savingsPercent,
        alerts: validateInvoiceSimulationInput(invoice, tariff, {
            energyPricingMode,
            activePeriods,
            currentInvoiceTotal,
            simulatedInvoiceTotal,
        }),
    };
}

export function validateInvoiceSimulationInput(
    invoice: InvoiceSimulationInput,
    tariff: TariffSimulationInput,
    context?: {
        energyPricingMode?: EnergyPricingMode;
        activePeriods?: ComparisonPeriod[];
        currentInvoiceTotal?: number;
        simulatedInvoiceTotal?: number;
    }
): QualityAlert[] {
    const alerts: QualityAlert[] = [];
    const activePeriods = context?.activePeriods || activePeriodsForTariffType(tariff.tariffType || invoice.tariffType);
    const energyTotal = activePeriods.reduce((total, period) => total + (invoice.energyKwh[period] || 0), 0);
    const powerTotal = activePeriods.reduce((total, period) => total + (invoice.contractedPowerKw[period] || 0), 0);

    if (!invoice.days || invoice.days <= 0) {
        alerts.push({
            level: 'critical',
            code: 'missing_days',
            message: 'No se han detectado dias de facturacion validos. El ahorro anual no es fiable.',
        });
    }

    if (!invoice.currentInvoiceTotal || invoice.currentInvoiceTotal <= 0) {
        alerts.push({
            level: 'warning',
            code: 'missing_current_total',
            message: 'No hay total actual de factura. El sistema reconstruye el coste actual con los importes disponibles.',
        });
    }

    if (!invoice.cups) {
        alerts.push({
            level: 'warning',
            code: 'missing_cups',
            message: 'No hay CUPS confirmado. No se puede cruzar consumo anual SIPS ni trazabilidad del suministro.',
        });
    }

    if (!invoice.hasSipsAnnualConsumption) {
        alerts.push({
            level: 'info',
            code: 'missing_sips_consumption',
            message: 'Sin consumo anual SIPS/CNMC confirmado. Las comisiones por tramo MWh deben validarse antes de cerrar.',
        });
    }

    if ((invoice.excludedServicesAmount || 0) > 0) {
        alerts.push({
            level: 'info',
            code: 'services_excluded',
            message: 'La comparativa excluye servicios comerciales actuales para comparar solo energia, potencia y cargos obligatorios.',
        });
    }

    if ((invoice.surplusExportKwh || 0) > 0 && !tariff.surplusCompensationPrice) {
        alerts.push({
            level: 'warning',
            code: 'missing_surplus_compensation_price',
            message: 'Factura con autoconsumo/excedentes. Falta precio de compensacion en la tarifa comparada.',
        });
    }

    if ((invoice.reactiveEnergyAmount || 0) > 0) {
        alerts.push({
            level: 'warning',
            code: 'reactive_energy_detected',
            message: 'La factura incluye energia reactiva. Se copia el importe en la comparativa y conviene revisar compensacion tecnica.',
        });
    }

    if (energyTotal <= 0) {
        alerts.push({
            level: 'critical',
            code: 'missing_energy',
            message: 'No hay energia consumida por periodo. La comparativa no puede representar la factura real.',
        });
    }

    if (powerTotal <= 0) {
        alerts.push({
            level: 'warning',
            code: 'missing_power',
            message: 'No hay potencia contratada por periodo. El termino de potencia saldra incompleto.',
        });
    }

    const sourceType = normalizeTariffType(invoice.tariffType);
    const targetType = normalizeTariffType(tariff.tariffType);
    if (sourceType && targetType && sourceType !== targetType) {
        alerts.push({
            level: 'warning',
            code: 'tariff_type_mismatch',
            message: `La factura parece ${sourceType}, pero la tarifa comparada es ${targetType}. Revisar antes de proponer.`,
        });
    }

    return alerts;
}

function getSingleEnergyPrice(energyPrice: PeriodValues, activePeriods: ComparisonPeriod[]): number {
    return activePeriods.map(period => energyPrice[period] || 0).find(price => price > 0) || 0;
}

function getCurrentInvoiceTotal(invoice: InvoiceSimulationInput, days: number): number {
    if (invoice.currentInvoiceTotal && invoice.currentInvoiceTotal > 0) {
        return excludeCommercialServices(invoice.currentInvoiceTotal, invoice);
    }

    const reconstructedBeforeTax =
        (invoice.currentPowerCost || 0) +
        (invoice.currentEnergyCost || 0) +
        (invoice.bonoSocialAmount || 0) +
        (invoice.distributionExcessAmount || 0) +
        (invoice.reactiveEnergyAmount || 0);
    const electricityTax = reconstructedBeforeTax * (invoice.electricityTaxRate ?? DEFAULT_ELECTRICITY_TAX_RATE);
    const taxableBase = reconstructedBeforeTax + electricityTax + (invoice.meterRentalAmount || 0);
    const reconstructed = taxableBase * (1 + (invoice.vatRate ?? DEFAULT_VAT_RATE));

    return Math.max(reconstructed, MONEY_EPSILON) || days;
}

function excludeCommercialServices(total: number, invoice: InvoiceSimulationInput): number {
    const excludedServices = invoice.excludedServicesAmount || 0;
    if (excludedServices <= 0) return total;

    const totalExcludedWithVat = excludedServices * (1 + (invoice.vatRate ?? DEFAULT_VAT_RATE));
    return Math.max(total - totalExcludedWithVat, 0);
}

function normalizeTariffType(value?: TariffAccessType): string | null {
    const normalized = (value || '').toUpperCase();
    if (normalized.includes('2.0')) return '2.0TD';
    if (normalized.includes('3.0')) return '3.0TD';
    if (normalized.includes('6.1')) return '6.1TD';
    return null;
}

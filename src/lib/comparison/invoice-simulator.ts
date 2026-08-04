export type ComparisonPeriod = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';
export type TariffAccessType = '2.0TD' | '3.0TD' | '6.1TD' | string;
export type EnergyPricingMode = 'single' | 'periods';
export type QualityAlertLevel = 'info' | 'warning' | 'critical';

/**
 * How a marketer treats adjustment services (servicios de ajuste, SSA).
 *
 * SSA are a variable system cost and the market handles them in three incompatible ways.
 * Comparing an offer that bundles them against one that bills them on top, without
 * normalising, overstates the second offer's saving by the whole SSA amount. The client
 * discovers it on the first invoice, which is the shortest path to an early termination
 * and the resulting commission clawback.
 *
 * - `included`            SSA are inside the energy price. Nothing to add.
 * - `billed_separately`   SSA are charged on top of energy at the market rate.
 * - `included_with_cap`   Included up to `ssaIncludedEurMwh`; the excess over that cap is
 *                         passed through to the client.
 * - `unknown`             Not configured. Nothing is added and a warning is raised, because
 *                         a silent zero here is indistinguishable from `included`.
 */
export type SsaTreatment = 'included' | 'billed_separately' | 'included_with_cap' | 'unknown';

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
    /**
     * Reference market price for adjustment services, in EUR/MWh. Supplied from
     * configuration; when absent the simulator falls back to DEFAULT_SSA_MARKET_RATE_EUR_MWH
     * and flags the assumption, rather than silently pricing SSA at zero.
     */
    ssaMarketRateEurMwh?: number;
    /** SSA already billed separately on the current invoice, used only when rebuilding it. */
    ssaAmount?: number;
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
    ssaTreatment?: SsaTreatment;
    /** Cap included in the energy price, in EUR/MWh. Only used with `included_with_cap`. */
    ssaIncludedEurMwh?: number;
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
// Tipo simplificado del impuesto electrico que usa el comparador manual de Zinergia (5.11%).
const DEFAULT_ELECTRICITY_TAX_RATE = 0.0511;
const DEFAULT_VAT_RATE = 0.21;
const ACCOUNTING_MONTH_DAYS = 30.4167;
// Factor de anualizacion fijo del Excel manual (asume facturas de ~32 dias).
// 11.3 = 365/32 aproximadamente. Mantener constante para que los totales anuales coincidan con la herramienta manual.
const ANNUAL_FACTOR_EXCEL = 11.3;
const MONEY_EPSILON = 0.005;
/**
 * Fallback reference for adjustment services, in EUR/MWh. Marketer caps observed in the
 * market cluster around 12-21 EUR/MWh. This is an assumption, not a measurement: whenever
 * it is used instead of a configured rate the simulator raises `ssa_market_rate_assumed`.
 */
export const DEFAULT_SSA_MARKET_RATE_EUR_MWH = 12;

/** Where the adjustment-services reference used in a simulation came from. */
export type SsaRateSource = 'configured' | 'derived_from_invoice' | 'assumed';

/**
 * Resolves the EUR/MWh reference used to price adjustment services, best source first:
 *
 *  1. `configured`            an explicit rate was supplied.
 *  2. `derived_from_invoice`  the client's own bill already itemises SSA, so the effective
 *                             rate they are actually paying is amount / MWh. This beats any
 *                             market average, because it is this supply's real number.
 *  3. `assumed`               nothing to go on; fall back to the constant and say so.
 *
 * The third case is the only one that should make anyone uncomfortable, which is why the
 * simulation reports the source rather than presenting all three as equivalent.
 */
export function resolveSsaMarketRate(
    invoice: Pick<InvoiceSimulationInput, 'ssaMarketRateEurMwh' | 'ssaAmount'>,
    totalEnergyKwh: number,
): { value: number; source: SsaRateSource } {
    if (typeof invoice.ssaMarketRateEurMwh === 'number'
        && Number.isFinite(invoice.ssaMarketRateEurMwh)
        && invoice.ssaMarketRateEurMwh >= 0) {
        return { value: invoice.ssaMarketRateEurMwh, source: 'configured' };
    }

    const megawattHours = Math.max(0, totalEnergyKwh) / 1000;
    const billed = invoice.ssaAmount || 0;
    if (megawattHours > 0 && billed > 0) {
        return { value: billed / megawattHours, source: 'derived_from_invoice' };
    }

    return { value: DEFAULT_SSA_MARKET_RATE_EUR_MWH, source: 'assumed' };
}

/**
 * Cost of adjustment services that the client would pay on top of the energy term, for a
 * given treatment. Returns EUR for the billed period.
 */
export function calculateAdjustmentServicesCost(
    totalEnergyKwh: number,
    treatment: SsaTreatment,
    marketRateEurMwh: number,
    includedEurMwh = 0,
): number {
    const megawattHours = Math.max(0, totalEnergyKwh) / 1000;
    if (megawattHours === 0) return 0;

    switch (treatment) {
        case 'billed_separately':
            return megawattHours * Math.max(0, marketRateEurMwh);
        case 'included_with_cap':
            return megawattHours * Math.max(0, marketRateEurMwh - Math.max(0, includedEurMwh));
        case 'included':
        case 'unknown':
        default:
            return 0;
    }
}

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
    const ssaTreatment = tariff.ssaTreatment || 'unknown';
    const ssaRate = resolveSsaMarketRate(invoice, totalEnergyKwh);
    const ssaMarketRate = ssaRate.value;
    const adjustmentServices = calculateAdjustmentServicesCost(
        totalEnergyKwh,
        ssaTreatment,
        ssaMarketRate,
        tariff.ssaIncludedEurMwh,
    );

    const subtotalBeforeTax = powerCost + energyCost + fixedFee + bonoSocial + distributionExcess + reactiveEnergy + adjustmentServices - surplusCompensation;
    const electricityTax = subtotalBeforeTax * electricityTaxRate;
    const taxableBase = subtotalBeforeTax + electricityTax + meterRental;
    const vat = taxableBase * vatRate;
    const simulatedInvoiceTotal = taxableBase + vat;
    const currentInvoiceTotal = getCurrentInvoiceTotal(invoice, days);
    const periodSavings = currentInvoiceTotal - simulatedInvoiceTotal;
    // Factor 11.3 fijo (Excel Zinergia). Asume facturas mensuales de ~32 dias; revisar si el periodo difiere mucho.
    const annualCost = simulatedInvoiceTotal * ANNUAL_FACTOR_EXCEL;
    const annualSavings = periodSavings * ANNUAL_FACTOR_EXCEL;
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
                label: 'Servicios de ajuste',
                amount: adjustmentServices,
                formula: describeAdjustmentServices(ssaTreatment, ssaRate, tariff.ssaIncludedEurMwh),
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
            ssaRateSource: ssaRate.source,
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
        ssaRateSource?: SsaRateSource;
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

    const ssaTreatment = tariff.ssaTreatment || 'unknown';
    if (ssaTreatment === 'unknown') {
        alerts.push({
            level: 'warning',
            code: 'missing_ssa_treatment',
            message: 'La tarifa no declara como trata los servicios de ajuste. Comparar contra ofertas que los facturan aparte sobrestima el ahorro; confirmar antes de proponer.',
        });
    } else if (ssaTreatment === 'billed_separately' || ssaTreatment === 'included_with_cap') {
        const ssaRateSource = context?.ssaRateSource
            ?? resolveSsaMarketRate(invoice, energyTotal).source;

        if (ssaRateSource === 'assumed') {
            alerts.push({
                level: 'info',
                code: 'ssa_market_rate_assumed',
                message: `Servicios de ajuste valorados con la referencia por defecto de ${DEFAULT_SSA_MARKET_RATE_EUR_MWH} EUR/MWh. Es un concepto variable: revisar con la referencia de mercado vigente.`,
            });
        } else if (ssaRateSource === 'derived_from_invoice') {
            // Worth saying out loud: this is the rate this supply actually pays today, which
            // is a stronger basis than any market average.
            alerts.push({
                level: 'info',
                code: 'ssa_market_rate_from_invoice',
                message: 'Servicios de ajuste valorados con la referencia deducida de la propia factura del cliente, no con una media de mercado.',
            });
        }
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

const SSA_RATE_SOURCE_LABEL: Record<SsaRateSource, string> = {
    configured: 'referencia configurada',
    derived_from_invoice: 'referencia deducida de la propia factura del cliente',
    assumed: 'referencia por defecto, no medida',
};

function describeAdjustmentServices(
    treatment: SsaTreatment,
    rate: { value: number; source: SsaRateSource },
    includedEurMwh?: number,
): string {
    const reference = `${round2(rate.value)} EUR/MWh (${SSA_RATE_SOURCE_LABEL[rate.source]})`;
    switch (treatment) {
        case 'included':
            return 'La comercializadora los incluye en el precio de energia; no se anade importe';
        case 'billed_separately':
            return `MWh consumidos x ${reference}, facturados aparte del precio de energia`;
        case 'included_with_cap':
            return `MWh consumidos x exceso sobre el techo incluido (${includedEurMwh || 0} EUR/MWh) respecto a ${reference}`;
        case 'unknown':
        default:
            return 'Tratamiento no configurado en la tarifa; no se anade importe y la comparativa no esta normalizada';
    }
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
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
        (invoice.reactiveEnergyAmount || 0) +
        // SSA billed separately on the current invoice are part of what the client pays
        // today. Omitting them here would understate the current cost and inflate savings.
        (invoice.ssaAmount || 0);
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

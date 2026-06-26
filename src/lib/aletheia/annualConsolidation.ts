import { createClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyInvoiceData {
    month: string;           // "2024-08"
    invoiceDate: string;
    periodDays: number;
    tariffType: '2.0TD' | '3.0TD' | '6.1TD' | string;
    // Energy (kWh) per period
    energyP1: number; energyP2: number; energyP3: number;
    energyP4: number; energyP5: number; energyP6: number;
    totalEnergy: number;
    // Contracted power (kW) per period
    powerP1: number; powerP2: number; powerP3: number;
    powerP4: number; powerP5: number; powerP6: number;
    // Maxímetro — measured peak demand (kW) per period
    maxDemandP1: number | null; maxDemandP2: number | null; maxDemandP3: number | null;
    maxDemandP4: number | null; maxDemandP5: number | null; maxDemandP6: number | null;
    // Costs
    totalAmount: number;
    reactiveEnergyCost: number;
    excessPowerCost: number;
    // Flags
    hasReactivePenalty: boolean;
    hasExcessPower: boolean;
}

export interface AnnualConsolidatedProfile {
    cups: string;
    tariffType: string;
    months: MonthlyInvoiceData[];
    // Confidence: how many months we actually have data for
    monthsCovered: number;
    confidenceLevel: 'estimacion' | 'fiable' | 'certificado';
    confidenceScore: number; // 0-100
    missingSeasons: Season[];
    // Annual aggregates
    totalEnergyKwh: number;
    annualTotalAmount: number;
    annualReactiveCost: number;
    annualExcessPowerCost: number;
    // Energy distribution across periods
    energyByPeriod: { p1: number; p2: number; p3: number; p4: number; p5: number; p6: number };
    // Peak demand (real maxímetro, or contracted if no maxímetro)
    peakDemandByPeriod: { p1: number; p2: number; p3: number; p4: number; p5: number; p6: number };
    contractedPowerByPeriod: { p1: number; p2: number; p3: number; p4: number; p5: number; p6: number };
    hasMaximeterData: boolean;
    reactiveRecurrent: boolean; // true if appears in >1 month
    seasonalRatio: SeasonalRatio;
}

export type Season = 'invierno' | 'primavera' | 'verano' | 'otoño';

export interface SeasonalRatio {
    winter: number;  // kWh average in winter months (dec, jan, feb)
    summer: number;  // kWh average in summer months (jun, jul, aug)
    spring: number;
    autumn: number;
    peakSeason: Season;
    valleySeason: Season;
    ratio: number;   // peak/valley — measures seasonality intensity
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEASON_MONTHS: Record<Season, number[]> = {
    invierno: [12, 1, 2],
    primavera: [3, 4, 5],
    verano: [6, 7, 8],
    otoño: [9, 10, 11],
};

function monthToSeason(month: string): Season {
    const m = parseInt(month.split('-')[1], 10);
    for (const [season, months] of Object.entries(SEASON_MONTHS) as [Season, number[]][]) {
        if (months.includes(m)) return season;
    }
    return 'primavera';
}

function confidenceLevel(monthsCovered: number): 'estimacion' | 'fiable' | 'certificado' {
    if (monthsCovered >= 4) return 'certificado';
    if (monthsCovered >= 2) return 'fiable';
    return 'estimacion';
}

function confidenceScore(monthsCovered: number): number {
    if (monthsCovered >= 4) return 100;
    if (monthsCovered === 3) return 75;
    if (monthsCovered === 2) return 50;
    return 20;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches all completed OCR jobs for the given CUPS (same agent),
 * deduplicates by billing month, and returns a rich annual profile.
 */
export async function consolidateCupsInvoices(cups: string): Promise<AnnualConsolidatedProfile | null> {
    if (!cups || cups.length < 18) return null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('extracted_data, created_at')
        .eq('agent_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(120);

    if (error || !data) return null;

    // Parse & deduplicate by billing month
    const byMonth = new Map<string, MonthlyInvoiceData>();

    for (const job of data) {
        const ext = job.extracted_data as Record<string, unknown> | null;
        if (!ext) continue;

        const jobCups = String(ext.cups ?? '').trim().toUpperCase();
        if (jobCups !== cups.trim().toUpperCase()) continue;

        const jDate = String(ext.invoice_date ?? job.created_at ?? '');
        const ym = parseYearMonth(jDate);
        if (!ym) continue;

        // Keep first (most recent upload) for each month
        if (byMonth.has(ym)) continue;

        const n = (k: string) => Number(ext[k] ?? 0);
        const nb = (k: string) => Boolean(ext[k]);
        const nn = (k: string) => (ext[k] != null ? Number(ext[k]) : null);

        const totalEnergy = [1,2,3,4,5,6].reduce((s, p) => s + n(`energy_p${p}`), 0);
        if (totalEnergy <= 0) continue;

        byMonth.set(ym, {
            month: ym,
            invoiceDate: jDate,
            periodDays: n('period_days') || 30,
            tariffType: String(ext.tariff_name ?? ext.detected_tariff_type ?? ''),
            energyP1: n('energy_p1'), energyP2: n('energy_p2'), energyP3: n('energy_p3'),
            energyP4: n('energy_p4'), energyP5: n('energy_p5'), energyP6: n('energy_p6'),
            totalEnergy,
            powerP1: n('power_p1'), powerP2: n('power_p2'), powerP3: n('power_p3'),
            powerP4: n('power_p4'), powerP5: n('power_p5'), powerP6: n('power_p6'),
            maxDemandP1: nn('max_demand_p1'), maxDemandP2: nn('max_demand_p2'),
            maxDemandP3: nn('max_demand_p3'), maxDemandP4: nn('max_demand_p4'),
            maxDemandP5: nn('max_demand_p5'), maxDemandP6: nn('max_demand_p6'),
            totalAmount: n('total_amount'),
            reactiveEnergyCost: n('reactive_energy_cost') || n('reactive_cost'),
            excessPowerCost: n('excess_power_cost') || n('distribution_excess_cost'),
            hasReactivePenalty: Boolean(
                (ext.forensic_details as Record<string, unknown> | null)?.reactive_penalty
            ) || (n('reactive_energy_cost') > 0) || (n('reactive_cost') > 0),
            hasExcessPower: n('excess_power_cost') > 0 || n('distribution_excess_cost') > 0,
        });
    }

    if (byMonth.size === 0) return null;

    const months = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
    const monthsCovered = months.length;
    const tariffType = months[months.length - 1].tariffType; // most recent

    // Annualize: sum and scale proportionally (each month = days/365 weight)
    const totalDays = months.reduce((s, m) => s + m.periodDays, 0);
    const scaleFactor = totalDays > 0 ? 365 / totalDays : 1;

    const sum = (key: keyof MonthlyInvoiceData) =>
        months.reduce((s, m) => s + (Number(m[key]) || 0), 0);

    const totalEnergyKwh = sum('totalEnergy') * scaleFactor;
    const annualTotalAmount = sum('totalAmount') * scaleFactor;
    const annualReactiveCost = sum('reactiveEnergyCost') * scaleFactor;
    const annualExcessPowerCost = sum('excessPowerCost') * scaleFactor;

    // Energy by period (annual)
    const energyByPeriod = {
        p1: sum('energyP1') * scaleFactor, p2: sum('energyP2') * scaleFactor,
        p3: sum('energyP3') * scaleFactor, p4: sum('energyP4') * scaleFactor,
        p5: sum('energyP5') * scaleFactor, p6: sum('energyP6') * scaleFactor,
    };

    // Contracted power: take the max across all months per period (most conservative)
    const maxPower = (key: keyof MonthlyInvoiceData) =>
        Math.max(0, ...months.map(m => Number(m[key]) || 0));

    const contractedPowerByPeriod = {
        p1: maxPower('powerP1'), p2: maxPower('powerP2'), p3: maxPower('powerP3'),
        p4: maxPower('powerP4'), p5: maxPower('powerP5'), p6: maxPower('powerP6'),
    };

    // Peak demand from maxímetro: max across all months per period
    const hasMaximeterData = months.some(m =>
        m.maxDemandP1 != null || m.maxDemandP2 != null || m.maxDemandP3 != null
    );

    const maxDemand = (mKey: keyof MonthlyInvoiceData) =>
        hasMaximeterData
            ? Math.max(0, ...months.map(m => Number(m[mKey] ?? 0)))
            : 0;

    const peakDemandByPeriod = {
        p1: maxDemand('maxDemandP1') || contractedPowerByPeriod.p1,
        p2: maxDemand('maxDemandP2') || contractedPowerByPeriod.p2,
        p3: maxDemand('maxDemandP3') || contractedPowerByPeriod.p3,
        p4: maxDemand('maxDemandP4') || contractedPowerByPeriod.p4,
        p5: maxDemand('maxDemandP5') || contractedPowerByPeriod.p5,
        p6: maxDemand('maxDemandP6') || contractedPowerByPeriod.p6,
    };

    // Reactive: recurrent if appears in more than 1 month
    const reactiveRecurrent = months.filter(m => m.hasReactivePenalty).length > 1;

    // Seasonal ratio
    const seasonalRatio = computeSeasonalRatio(months);

    // Missing seasons
    const coveredSeasons = new Set(months.map(m => monthToSeason(m.month)));
    const allSeasons: Season[] = ['invierno', 'primavera', 'verano', 'otoño'];
    const missingSeasons = allSeasons.filter(s => !coveredSeasons.has(s));

    return {
        cups,
        tariffType,
        months,
        monthsCovered,
        confidenceLevel: confidenceLevel(monthsCovered),
        confidenceScore: confidenceScore(monthsCovered),
        missingSeasons,
        totalEnergyKwh,
        annualTotalAmount,
        annualReactiveCost,
        annualExcessPowerCost,
        energyByPeriod,
        peakDemandByPeriod,
        contractedPowerByPeriod,
        hasMaximeterData,
        reactiveRecurrent,
        seasonalRatio,
    };
}

function computeSeasonalRatio(months: MonthlyInvoiceData[]): SeasonalRatio {
    const bySeasonKwh: Record<Season, number[]> = {
        invierno: [], primavera: [], verano: [], otoño: [],
    };

    for (const m of months) {
        const season = monthToSeason(m.month);
        bySeasonKwh[season].push(m.totalEnergy);
    }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    const winter = avg(bySeasonKwh.invierno);
    const summer = avg(bySeasonKwh.verano);
    const spring = avg(bySeasonKwh.primavera);
    const autumn = avg(bySeasonKwh.otoño);

    const vals: [Season, number][] = [['invierno', winter], ['primavera', spring], ['verano', summer], ['otoño', autumn]]
        .filter(([, v]) => (v as number) > 0) as [Season, number][];

    const sorted = [...vals].sort((a, b) => b[1] - a[1]);
    const peakSeason: Season = sorted[0]?.[0] ?? 'verano';
    const valleySeason: Season = sorted[sorted.length - 1]?.[0] ?? 'invierno';
    const ratio = vals.length > 1 && sorted[sorted.length - 1][1] > 0
        ? sorted[0][1] / sorted[sorted.length - 1][1]
        : 1;

    return { winter, summer, spring, autumn, peakSeason, valleySeason, ratio };
}

function parseYearMonth(dateStr: string): string | null {
    const iso = dateStr.match(/(\d{4})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}`;
    const dmy = dateStr.match(/\d{2}\/(\d{2})\/(\d{4})/);
    if (dmy) return `${dmy[2]}-${dmy[1]}`;
    const my = dateStr.match(/(\d{2})\/(\d{4})/);
    if (my) return `${my[2]}-${my[1]}`;
    return null;
}

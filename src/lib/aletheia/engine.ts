import { Auditor } from './auditor';
import { REE_PROFILES } from './config';
import { Normalizer } from './normalizer';
import { Optimizer } from './optimizer';
import { Profiler } from './profiler';
import { AletheiaResult, InvoiceData, SimulationResult, TariffCandidate, TariffPeriod } from './types';
import { simulateInvoiceComparison } from '@/lib/comparison/invoice-simulator';
import { buildSupervisedRecommendations } from '@/lib/supervised/recommender';

export class AletheiaEngine {

    /**
     * Main simulation execution method
     */
    static run(invoice: InvoiceData, tariffs: TariffCandidate[]): AletheiaResult {

        // 1. Audit, Profile & Optimization
        const opportunities = Auditor.audit(invoice);
        const profile = Profiler.analyze(invoice);
        const optimizationRecommendations = Optimizer.analyze(invoice);

        // 2. Determine active periods based on tariff type
        let activePeriods: TariffPeriod[];

        switch (invoice.tariff_type) {
            case '2.0TD':
                activePeriods = ['p1', 'p2', 'p3'];
                break;
            case '3.0TD':
                activePeriods = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
                break;
            case '6.1TD':
            default:
                activePeriods = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
                break;
        }

        // 3. Project Annual Consumption for accurate comparison
        // We pick the middle date of the invoice to determine seasonality
        const invoiceStart = new Date(invoice.period_start);
        const invoiceEnd = new Date(invoice.period_end);
        const midDate = new Date((invoiceStart.getTime() + invoiceEnd.getTime()) / 2);

        // Calculate projected annual kWh for each active period
        const projectedEnergy: Record<string, number> = {};
        let totalProjectedKwh = 0;

        activePeriods.forEach(p => {
            const kwh = invoice.energy_consumption[p] || 0;
            const projected = Normalizer.projectAnnualConsumption(kwh, midDate);
            projectedEnergy[p] = projected;
            totalProjectedKwh += projected;
        });

        // 3. Project Annual Current Costs (Current Situation)
        // If we have "Current Cost" from the invoice (e.g. 100€ for 30 days), we project it to 365.
        // This is a "naive" projection of the bill money, but valid for "Annual Spend" estimation.
        const currentBillTotal = invoice.current_total_amount && invoice.current_total_amount > 0
            ? invoice.current_total_amount
            : (invoice.current_cost_power + invoice.current_cost_energy + invoice.current_cost_rental + (invoice.current_cost_reactive || 0));
        const projectedAnnualSpend = (currentBillTotal / invoice.days_involced) * 365;

        // 4. Simulate Candidates
        const compatibleTariffs = tariffs.filter(tariff => {
            const invoiceType = normalizeTariffType(invoice.tariff_type);
            const candidateType = normalizeTariffType(tariff.tariff_type);
            return !candidateType || !invoiceType || candidateType === invoiceType;
        });

        const results: SimulationResult[] = compatibleTariffs.map(tariff => {
            const invoiceSimulation = simulateInvoiceComparison({
                days: invoice.days_involced,
                tariffType: invoice.tariff_type,
                contractedPowerKw: invoice.contracted_power,
                energyKwh: invoice.energy_consumption,
                currentInvoiceTotal: invoice.current_total_amount || undefined,
                currentPowerCost: invoice.current_cost_power,
                currentEnergyCost: invoice.current_cost_energy,
                bonoSocialAmount: invoice.bono_social_cost,
                distributionExcessAmount: invoice.distribution_excess_cost,
                reactiveEnergyAmount: invoice.reactive_energy_cost,
                excludedServicesAmount: invoice.excluded_services_cost,
                surplusExportKwh: invoice.surplus_export_kwh,
                meterRentalAmount: invoice.current_cost_rental,
                electricityTaxRate: invoice.electricity_tax_rate,
                vatRate: invoice.vat_rate,
                hasSipsAnnualConsumption: invoice.has_sips_annual_consumption,
            }, {
                id: tariff.id,
                company: tariff.company,
                name: tariff.name,
                tariffType: tariff.tariff_type,
                powerPrice: tariff.power_price,
                energyPrice: tariff.energy_price,
                fixedFeeMonthly: tariff.fixed_fee,
                surplusCompensationPrice: tariff.surplus_compensation_price,
            });

            const periodPowerCost = invoiceSimulation.lines.find(line => line.label === 'Potencia contratada')?.amount || 0;
            const periodEnergyCost = invoiceSimulation.lines.find(line => line.label === 'Energia consumida')?.amount || 0;
            const annualPowerCost = (periodPowerCost / invoice.days_involced) * 365;
            const annualEnergyCost = (periodEnergyCost / invoice.days_involced) * 365;
            const totalAnnualEst = invoiceSimulation.annualCost;
            const savings = invoiceSimulation.annualSavings;

            // Scoring Logic
            // Base score = Savings
            // Penalties: Permanence
            let score = savings;
            if (tariff.permanence_months > 0) {
                score -= 50; // Arbitrary penalty points for permanence
            }
            // Tags Boost
            if (profile.tags.includes('WEEKEND_WARRIOR') && tariff.type === 'indexed') {
                score += 20; // Boost indexed for night owls
            }

            return {
                tariff_id: tariff.id,
                tariff_name: tariff.name,
                company: tariff.company,
                candidate: tariff,
                annual_cost_total: totalAnnualEst,
                annual_cost_power: annualPowerCost,
                annual_cost_energy: annualEnergyCost,
                annual_savings: savings,
                score: score,
                is_best_value: false, // determined later
                invoice_simulation: invoiceSimulation,
            };
        });

        // 5. Rank & Filter
        const sorted = results.sort((a, b) => b.score - a.score);
        if (sorted.length > 0) {
            sorted[0].is_best_value = true;
        }

        const supervisedRecommendation = buildSupervisedRecommendations(sorted.map(result => ({
            id: result.tariff_id,
            tariffName: result.tariff_name,
            company: result.company,
            annualSavings: result.annual_savings,
            annualCost: result.annual_cost_total,
            estimatedAgentCommission: result.candidate.estimated_agent_commission,
            criticalAlerts: result.invoice_simulation?.alerts.filter(alert => alert.level === 'critical').length || 0,
            warningAlerts: result.invoice_simulation?.alerts.filter(alert => alert.level === 'warning').length || 0,
            hasMissingCommission: result.candidate.commission_source !== 'tariff_commissions',
        })));

        return {
            analysis_meta: {
                invoice_days: invoice.days_involced,
                projected_annual_kwh: totalProjectedKwh,
                seasonality_factor_applied: REE_PROFILES[midDate.getMonth()],
            },
            current_status: {
                annual_projected_cost: projectedAnnualSpend,
                avg_price_kwh: (invoice.current_cost_energy / (totalProjectedKwh / (365 / invoice.days_involced))), // Rough estimate of billed kWh price
                inefficiencies_detected: [...opportunities.map(o => o.title), ...(invoice.warnings || [])],
            },
            opportunities: opportunities,
            optimization_recommendations: optimizationRecommendations,
            client_profile: profile,
            top_proposals: sorted.slice(0, 3), // Return Top 3
            supervised_recommendation: supervisedRecommendation,
        };
    }
}

function normalizeTariffType(value?: string): string | null {
    const normalized = (value || '').toUpperCase();
    if (normalized.includes('2.0')) return '2.0TD';
    if (normalized.includes('3.0')) return '3.0TD';
    if (normalized.includes('6.1')) return '6.1TD';
    return null;
}

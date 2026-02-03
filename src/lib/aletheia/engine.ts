import { Auditor } from './auditor';
import { REE_PROFILES } from './config';
import { Normalizer } from './normalizer';
import { Optimizer } from './optimizer';
import { Profiler } from './profiler';
import { AletheiaResult, InvoiceData, SimulationResult, TariffCandidate, TariffPeriod } from './types';

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
                activePeriods = ['p1', 'p2', 'p3'];
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
        const currentBillTotal = (invoice.current_cost_power + invoice.current_cost_energy + invoice.current_cost_rental + (invoice.current_cost_reactive || 0));
        const projectedAnnualSpend = (currentBillTotal / invoice.days_involced) * 365;

        // 4. Simulate Candidates
        const results: SimulationResult[] = tariffs.map(tariff => {
            let annualPowerCost = 0;
            let annualEnergyCost = 0;

            // Power Cost: Sum(Contracted_kW * Price_kW_Day * 365)
            // Note: We use the INVOICE contracted power (unless we implement optimization logic here)
            // *Optimization Idea*: If Auditor detected Power Opportunity, we could run a second simulation with optimized power *
            activePeriods.forEach(p => {
                const powerKw = invoice.contracted_power[p] || 0;
                // Normalize tariff price to DAILY
                const priceDaily = Normalizer.normalizeToDaily(tariff.power_price[p] || 0, 'daily'); // Assuming DB stores daily or we handle it
                annualPowerCost += (powerKw * priceDaily * 365);
            });

            // Energy Cost: Sum(Projected_kWh * Price_kWh)
            activePeriods.forEach(p => {
                const kwh = projectedEnergy[p] || 0;
                const price = tariff.energy_price[p] || 0;
                annualEnergyCost += (kwh * price);
            });

            const fixedFeeAnnual = (tariff.fixed_fee || 0) * 12;

            // Add Pass-throughs (Reactive + Rental)
            // These stay with the client regardless of tariff (mostly)
            // Reactive might change if using a capacitor bank, but comparing strictly Tariff vs Tariff, they persist.
            const reactiveAnnual = (invoice.current_cost_reactive / invoice.days_involced) * 365;
            const rentalAnnual = (invoice.current_cost_rental / invoice.days_involced) * 365;

            const totalAnnualEst = annualPowerCost + annualEnergyCost + fixedFeeAnnual + reactiveAnnual + rentalAnnual;
            const savings = projectedAnnualSpend - totalAnnualEst;

            // Scoring Logic
            // Base score = Savings
            // Penalties: Permanence
            let score = savings;
            if (tariff.permanence_months > 0) {
                score -= 50; // Arbitrary penalty points for permanence
            }
            // Tags Boost
            if (profile.tags.includes('NIGHT_OWL') && tariff.type === 'indexed') {
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
                is_best_value: false // determined later
            };
        });

        // 5. Rank & Filter
        const sorted = results.sort((a, b) => b.score - a.score);
        if (sorted.length > 0) {
            sorted[0].is_best_value = true;
        }

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
            top_proposals: sorted.slice(0, 3) // Return Top 3
        };
    }
}

import { HARDWARE_COSTS, THRESHOLDS } from './config';
import { AuditOpportunity, InvoiceData, TariffPeriod } from './types';

export class Auditor {

    /**
     * Phase 1: Forensic Analysis
     * Detects "Wasted Money" and ROI opportunities
     */
    static audit(data: InvoiceData): AuditOpportunity[] {
        const opportunities: AuditOpportunity[] = [];

        // 1. Reactive Power Check
        if (data.current_cost_reactive > 0) {
            // Annualize the penalty using simple projection (or sophisticated if we had full year history)
            // Assuming this penalty is typical for the month
            const annualPenalty = (data.current_cost_reactive / data.days_involced) * 365;

            // ROI Calculation
            // We assume a standard capacitor bank size required based on penalty magnitude (heuristic)
            // A more accurate calc would need cos-phi data, but we use money as proxy.
            const estimatedBankCost = HARDWARE_COSTS.CAPACITOR_BANK_BASE + (annualPenalty * 0.5); // Heuristic: bigger penalty = bigger bank
            const roiMonths = (estimatedBankCost / (annualPenalty / 12));

            opportunities.push({
                type: 'REACTIVE_COMPENSATION',
                title: 'Eliminación de Energía Reactiva',
                description: `Está pagando penalizaciones por energía reactiva. La instalación de una batería de condensadores eliminaría este coste permanentemente.`,
                annual_savings: annualPenalty,
                investment_cost: estimatedBankCost,
                roi_months: roiMonths,
                priority: 'HIGH'
            });
        }

        // 2. Power Optimization Check
        // If Contracted >> MaxDemand, suggest reduction.
        if (data.max_demand) {
            let potentialPowerSavings = 0;
            
            // Determine active periods based on tariff type
            let activePeriods: TariffPeriod[];
            switch (data.tariff_type) {
                case '2.0TD':
                case '3.0TD':
                    activePeriods = ['p1', 'p2', 'p3'];
                    break;
                case '6.1TD':
                default:
                    activePeriods = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
                    break;
            }

            // Check all active periods for over-contracted power
            const overContractedPeriods: TariffPeriod[] = [];
            let totalPotentialSavings = 0;
            
            // Average market price for power (€/kW/day) - conservative estimate
            const avgPowerPrice = 0.12;

            activePeriods.forEach(p => {
                const contracted = data.contracted_power[p];
                const max = data.max_demand![p];
                
                if (contracted > 0 && max > 0 && contracted > (max * (1 + THRESHOLDS.POWER_BLOAT_BUFFER))) {
                    const recommendedPower = Math.ceil(max * (1 + THRESHOLDS.POWER_BLOAT_BUFFER) * 10) / 10; // Round to 1 decimal
                    const powerReduction = contracted - recommendedPower;
                    const periodSavings = powerReduction * avgPowerPrice * 365;
                    
                    overContractedPeriods.push(p);
                    totalPotentialSavings += periodSavings;
                }
            });

            if (overContractedPeriods.length > 0) {
                opportunities.push({
                    type: 'POWER_OPTIMIZATION',
                    title: 'Exceso de Potencia Contratada',
                    description: `Tiene más potencia contratada de la que necesita en ${overContractedPeriods.length > 1 ? 'varios periodos' : 'un periodo'}. Podría optimizar sus potencias para ahorrar aproximadamente ${totalPotentialSavings.toFixed(0)}€/año sin riesgo de cortes por exceso de demanda.`,
                    annual_savings: totalPotentialSavings,
                    priority: totalPotentialSavings > 100 ? 'HIGH' : 'MEDIUM'
                });
            }
        } else if (data.tariff_type === '3.0TD') {
            // Safety Flag: 3.0TD but NO Maximeter data
            // Only internally relevant, maybe we don't push an opportunity, but we log a warning?
            // Actually, the Plan said we block optimization.
        }

        return opportunities;
    }
}

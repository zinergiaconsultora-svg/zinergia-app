import { THRESHOLDS, TAX_CONFIG } from './config';
import { InvoiceData, TariffPeriod, OptimizationRecommendation } from './types';

export class Optimizer {

    /**
     * Analyzes power consumption and generates detailed recommendations
     */
    static analyzePowerOptimization(data: InvoiceData): OptimizationRecommendation[] {
        const recommendations: OptimizationRecommendation[] = [];

        if (!data.max_demand) {
            // Cannot optimize without max demand data
            return recommendations;
        }

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

        // Average market prices for power (€/kW/day)
        const powerPrices: Record<string, number> = {
            'p1': 0.13,  // Peak - most expensive
            'p2': 0.08,  // Mid
            'p3': 0.05,  // Valley - cheapest
            'p4': 0.10,
            'p5': 0.07,
            'p6': 0.04
        };

        let totalPotentialSavings = 0;
        const optimizationDetails: { period: string; current: number; recommended: number; savings: number }[] = [];

        activePeriods.forEach(p => {
            const contracted = data.contracted_power[p];
            const max = data.max_demand![p];

            if (contracted > 0 && max > 0) {
                // Calculate optimal power (max demand + 15% safety margin)
                const recommendedPower = Math.ceil(max * 1.15 * 10) / 10; // Round to 1 decimal
                const powerReduction = contracted - recommendedPower;

                if (powerReduction > 0) {
                    const periodPrice = powerPrices[p] || 0.10;
                    const periodSavings = powerReduction * periodPrice * 365;
                    
                    totalPotentialSavings += periodSavings;
                    optimizationDetails.push({
                        period: p.toUpperCase(),
                        current: contracted,
                        recommended: recommendedPower,
                        savings: periodSavings
                    });
                }
            }
        });

        if (optimizationDetails.length > 0) {
            recommendations.push({
                type: 'POWER_OPTIMIZATION',
                title: 'Optimización de Potencias Contratadas',
                description: `Podría reducir su factura en aproximadamente ${totalPotentialSavings.toFixed(0)}€/año optimizando las potencias contratadas. Le recomendamos ajustar sus potencias a los siguientes valores:`,
                annual_savings: totalPotentialSavings,
                details: optimizationDetails,
                priority: totalPotentialSavings > 100 ? 'HIGH' : 'MEDIUM',
                action_items: optimizationDetails.map(d => 
                    `Reducir potencia ${d.period}: de ${d.current}kW a ${d.recommended}kW (ahorro: ${d.savings.toFixed(0)}€/año)`
                )
            });
        }

        return recommendations;
    }

    /**
     * Analyzes energy consumption patterns and generates recommendations
     */
    static analyzeEnergyConsumption(data: InvoiceData): OptimizationRecommendation[] {
        const recommendations: OptimizationRecommendation[] = [];

        // Determine active periods
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

        // Calculate total consumption and period distribution
        let totalConsumption = 0;
        const periodConsumption: Record<string, number> = {};
        
        activePeriods.forEach(p => {
            const consumption = data.energy_consumption[p] || 0;
            periodConsumption[p] = consumption;
            totalConsumption += consumption;
        });

        if (totalConsumption === 0) {
            return recommendations;
        }

        // Analyze consumption distribution
        const p1Consumption = periodConsumption['p1'] || 0;
        const p3Consumption = periodConsumption['p3'] || 0;
        const p6Consumption = data.tariff_type === '6.1TD' ? (periodConsumption['p6'] || 0) : 0;
        const valleyConsumption = (periodConsumption['p3'] || 0) + (periodConsumption['p6'] || 0);

        const p1Ratio = p1Consumption / totalConsumption;
        const valleyRatio = valleyConsumption / totalConsumption;

        // High peak consumption recommendation
        if (p1Ratio > 0.5) {
            recommendations.push({
                type: 'ENERGY_SHIFT',
                title: 'Desplazamiento de Consumo a Horas Valle',
                description: `El ${(p1Ratio * 100).toFixed(0)}% de su consumo se realiza en horas punta. Mover parte de este consumo a horas valle (P3 o P6) podría reducir significativamente su factura.`,
                annual_savings: 0, // Cannot calculate without tariff comparison
                priority: 'MEDIUM',
                action_items: [
                    'Evaluar uso de electrodomésticos de alto consumo en horas valle',
                    'Considerar batería para autoconsumo si tiene instalación solar',
                    'Revisar horarios de maquinaria o equipos de alto consumo'
                ]
            });
        }

        // Low valley consumption recommendation
        if (valleyRatio < 0.3 && data.tariff_type !== '6.1TD') {
            recommendations.push({
                type: 'TARIFF_RECOMMENDATION',
                title: 'Considerar Tarifa 3.1TD con Discriminación Horaria',
                description: `Actualmente solo usa el ${(valleyRatio * 100).toFixed(0)}% de su consumo en horas valle. Si puede desplazar parte de su consumo a horas nocturnas o fines de semana, una tarifa 3.1TD podría ofrecer importantes ahorros.`,
                annual_savings: 0,
                priority: 'LOW',
                action_items: [
                    'Analizar qué equipos podrían operar en horario nocturno',
                    'Evaluar si la actividad del negocio permite flexibilidad horaria',
                    'Comparar ofertas de tarifas con y sin discriminación'
                ]
            });
        }

        return recommendations;
    }

    /**
     * Analyzes energy efficiency opportunities
     */
    static analyzeEnergyEfficiency(data: InvoiceData): OptimizationRecommendation[] {
        const recommendations: OptimizationRecommendation[] = [];

        // Calculate average kWh per day
        const totalConsumption = Object.values(data.energy_consumption).reduce((sum, val) => sum + (val || 0), 0);
        const dailyConsumption = totalConsumption / data.days_involced;
        const annualConsumption = dailyConsumption * 365;

        // High consumption recommendation
        if (annualConsumption > 100000) { // > 100 MWh/year - industrial scale
            recommendations.push({
                type: 'EFFICIENCY_AUDIT',
                title: 'Auditoría de Eficiencia Energética',
                description: `Su consumo anual supera los 100 MWh. Recomendamos realizar una auditoría energética completa para identificar oportunidades de optimización que podrían reducir su factura entre un 10% y un 20%.`,
                annual_savings: annualConsumption * 0.15 * 0.20, // Estimate 15% savings at avg 0.20€/kWh
                priority: 'HIGH',
                action_items: [
                    'Contratar auditoría energética certificada',
                    'Evaluar mejora de eficiencia de motores y equipos',
                    'Considerar sistemas de gestión energética (ISO 50001)',
                    'Analizar oportunidad de generación solar propia'
                ]
            });
        } else if (annualConsumption > 30000) { // > 30 MWh/year - medium business
            recommendations.push({
                type: 'SOLAR_EVALUATION',
                title: 'Evaluar Autoconsumo Fotovoltaico',
                description: `Su consumo anual supera los 30 MWh. Una instalación solar de tamaño medio podría generar una parte significativa de su energía y reducir drásticamente su factura eléctrica.`,
                annual_savings: annualConsumption * 0.5 * 0.20, // Estimate covering 50% with solar
                priority: 'MEDIUM',
                action_items: [
                    'Solicitar estudio de viabilidad solar',
                    'Analizar consumo diurno para dimensionar instalación',
                    'Evaluar opciones de batería para almacenamiento',
                    'Revisar programas de ayudas y subvenciones disponibles'
                ]
            });
        }

        return recommendations;
    }

    /**
     * Main entry point - generates all optimization recommendations
     */
    static analyze(data: InvoiceData): OptimizationRecommendation[] {
        const allRecommendations: OptimizationRecommendation[] = [];

        // Power optimization
        allRecommendations.push(...this.analyzePowerOptimization(data));

        // Energy consumption analysis
        allRecommendations.push(...this.analyzeEnergyConsumption(data));

        // Energy efficiency opportunities
        allRecommendations.push(...this.analyzeEnergyEfficiency(data));

        // Sort by priority and savings
        return allRecommendations.sort((a, b) => {
            const priorityScore = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            const priorityDiff = priorityScore[b.priority] - priorityScore[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return (b.annual_savings || 0) - (a.annual_savings || 0);
        });
    }
}
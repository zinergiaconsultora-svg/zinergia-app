import { describe, expect, it } from 'vitest';
import { buildSupervisedRecommendations } from '../recommender';

describe('supervised recommender', () => {
    it('keeps max savings and surfaces a balanced option with stronger commission', () => {
        const result = buildSupervisedRecommendations([
            {
                id: 'a',
                tariffName: 'Max ahorro',
                company: 'A',
                annualSavings: 1200,
                annualCost: 5000,
                estimatedAgentCommission: 80,
            },
            {
                id: 'b',
                tariffName: 'Equilibrada',
                company: 'B',
                annualSavings: 1050,
                annualCost: 5150,
                estimatedAgentCommission: 260,
            },
        ]);

        expect(result.recommendations.find(r => r.kind === 'max_savings')?.candidate.id).toBe('a');
        expect(result.recommendations.find(r => r.kind === 'balanced')?.candidate.id).toBe('b');
        expect(result.recommendations.find(r => r.kind === 'best_viable_commission')?.candidate.id).toBeUndefined();
    });

    it('does not return the same tariff twice with different recommendation labels', () => {
        const result = buildSupervisedRecommendations([
            {
                id: 'a',
                tariffName: 'Mejor en todo',
                company: 'A',
                annualSavings: 1200,
                annualCost: 5000,
                estimatedAgentCommission: 300,
            },
        ]);

        expect(result.recommendations.map(r => r.candidate.id)).toEqual(['a']);
    });

    it('does not recommend commission-only options with weak client savings', () => {
        const result = buildSupervisedRecommendations([
            {
                id: 'a',
                tariffName: 'Max ahorro',
                company: 'A',
                annualSavings: 1000,
                annualCost: 5000,
                estimatedAgentCommission: 90,
            },
            {
                id: 'b',
                tariffName: 'Comision alta pero poco ahorro',
                company: 'B',
                annualSavings: 300,
                annualCost: 5700,
                estimatedAgentCommission: 600,
            },
        ]);

        expect(result.recommendations.find(r => r.kind === 'best_viable_commission')?.candidate.id).not.toBe('b');
        expect(result.recommendations.find(r => r.kind === 'best_viable_commission')?.candidate.id).toBeUndefined();
    });

    it('blocks commercial recommendation when there is no positive savings', () => {
        const result = buildSupervisedRecommendations([
            {
                id: 'a',
                tariffName: 'Sin ahorro',
                company: 'A',
                annualSavings: -20,
                annualCost: 5000,
                estimatedAgentCommission: 100,
            },
        ]);

        expect(result.recommendations).toHaveLength(0);
        expect(result.guardrails[0]).toContain('No hay ninguna tarifa con ahorro comercialmente defendible');
    });

    it('blocks symbolic savings even if commission exists', () => {
        const result = buildSupervisedRecommendations([
            {
                id: 'a',
                tariffName: 'Ahorro simbolico',
                company: 'A',
                annualSavings: 12,
                annualCost: 5000,
                estimatedAgentCommission: 400,
            },
        ]);

        expect(result.recommendations).toHaveLength(0);
        expect(result.guardrails[0]).toContain('comercialmente defendible');
    });
});

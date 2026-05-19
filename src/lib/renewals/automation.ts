export interface RenewalAutomationInput {
    clientId: string;
    clientName?: string | null;
    proposalId: string;
    agentId: string;
    franchiseId?: string | null;
    marketer?: string | null;
    tariffName?: string | null;
    annualSavings: number;
    savingsPercent: number;
    existingTaskId?: string | null;
}

export interface RenewalAutomationPlan {
    shouldCreateTask: boolean;
    task: {
        client_id: string;
        proposal_id: string;
        agent_id: string;
        franchise_id: string | null;
        title: string;
        description: string;
        type: 'follow_up';
        priority: 'high' | 'medium';
        status: 'pending';
        due_date: string;
        auto_generated: true;
    } | null;
    notification: {
        user_id: string;
        title: string;
        message: string;
        type: 'tariff_update';
        link: string;
        expires_at: string;
    };
    push: {
        title: string;
        body: string;
        url: string;
    };
}

const DAY_MS = 86_400_000;

export function buildRenewalAutomationPlan(input: RenewalAutomationInput, now = new Date()): RenewalAutomationPlan {
    const clientName = input.clientName?.trim() || 'Cliente';
    const marketer = input.marketer?.trim() || 'la tarifa recomendada';
    const tariffName = input.tariffName?.trim();
    const roundedSavings = Math.round(input.annualSavings);
    const roundedPct = Math.round(input.savingsPercent * 10) / 10;
    const link = `/dashboard/clients/${input.clientId}?tab=renewal`;
    const savingsText = `${roundedSavings.toLocaleString('es-ES')} €/año`;
    const title = `Renovación: ${clientName}`;
    const description = [
        `${marketer}${tariffName ? ` · ${tariffName}` : ''}`,
        `Ahorro estimado: ${savingsText} (${roundedPct}%).`,
        'Revisar condiciones y crear propuesta antes de que venza la oportunidad.',
    ].join('\n');

    return {
        shouldCreateTask: !input.existingTaskId,
        task: input.existingTaskId ? null : {
            client_id: input.clientId,
            proposal_id: input.proposalId,
            agent_id: input.agentId,
            franchise_id: input.franchiseId ?? null,
            title,
            description,
            type: 'follow_up',
            priority: roundedPct >= 10 || roundedSavings >= 500 ? 'high' : 'medium',
            status: 'pending',
            due_date: new Date(now.getTime() + 7 * DAY_MS).toISOString(),
            auto_generated: true,
        },
        notification: {
            user_id: input.agentId,
            title: 'Oportunidad de renovación',
            message: `${clientName}: ${marketer} puede ahorrar ${savingsText}.`,
            type: 'tariff_update',
            link,
            expires_at: new Date(now.getTime() + 30 * DAY_MS).toISOString(),
        },
        push: {
            title: 'Renovación detectada',
            body: `${clientName} puede ahorrar ${savingsText}`,
            url: link,
        },
    };
}

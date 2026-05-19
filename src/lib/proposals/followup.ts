export type ProposalFollowupStage = 3 | 7;

export interface ProposalFollowupInput {
    stage: ProposalFollowupStage;
    clientName: string;
    annualSavings: number;
    opened: boolean;
    publicUrl?: string | null;
}

export interface ProposalFollowupPlan {
    notification: {
        title: string;
        message: string;
        type: 'followup_due';
        link: string;
    };
    push: {
        title: string;
        body: string;
        url: string;
        icon: string;
    };
}

export function buildProposalFollowupPlan(input: ProposalFollowupInput): ProposalFollowupPlan {
    const clientName = input.clientName.trim() || 'tu cliente';
    const savings = Math.round(input.annualSavings || 0);
    const link = '/dashboard/proposals';

    if (input.stage === 3) {
        const openedText = input.opened
            ? 'Ya ha abierto la propuesta. Buen momento para llamarle y resolver dudas.'
            : 'Todavia no ha abierto el enlace. Reenvia la propuesta o confirma que le ha llegado.';

        return {
            notification: {
                title: `Seguimiento: ${clientName}`,
                message: `${openedText} Ahorro estimado: ${savings} €/año.`,
                type: 'followup_due',
                link,
            },
            push: {
                title: `Seguimiento - ${clientName}`,
                body: input.opened
                    ? `Ha abierto la propuesta de ${savings} €/año. Llamada recomendada.`
                    : `3 dias sin apertura. Reenvia o confirma recepcion.`,
                url: link,
                icon: '/icon-192.png',
            },
        };
    }

    return {
        notification: {
            title: `Respuesta urgente: ${clientName}`,
            message: input.opened
                ? `La propuesta se abrio pero sigue sin firmarse. Prioriza una llamada comercial. Ahorro: ${savings} €/año.`
                : `7 dias sin apertura ni firma. Conviene contactar por telefono o WhatsApp. Ahorro: ${savings} €/año.`,
            type: 'followup_due',
            link,
        },
        push: {
            title: `Urge respuesta - ${clientName}`,
            body: input.opened
                ? `Abierta sin firma. Llama para cerrar la propuesta.`
                : `7 dias sin apertura. Cambia el canal de contacto.`,
            url: link,
            icon: '/icon-192.png',
        },
    };
}

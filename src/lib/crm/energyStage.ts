import { EnergyStage } from '@/types/energy';

interface ProposalSummary {
    status: string;
}

interface ContractSummary {
    status: string;
    end_date?: string;
}

interface AltaSummary {
    status: string;
}

interface EnergyStageInput {
    proposals?: ProposalSummary[];
    contracts?: ContractSummary[];
    altas?: AltaSummary[];
}

const RENEWAL_WINDOW_DAYS = 90;

/**
 * Calcula la etapa energética de un cliente basándose en sus propuestas,
 * contratos y expedientes ATR.
 *
 * Orden de prioridad (de más avanzado a menos):
 * renovable > activa > atr_en_curso > firmada > propuesta_enviada > factura_analizada > lead
 */
export function computeEnergyStage(input: EnergyStageInput): EnergyStage {
    const { proposals = [], contracts = [], altas = [] } = input;

    const hasAccepted = proposals.some(p => p.status === 'accepted');

    // ¿Contrato activo próximo a vencer?
    const now = new Date();
    const activeContracts = contracts.filter(c => c.status === 'active');
    const expiringContract = activeContracts.find(c => {
        if (!c.end_date) return false;
        const days = Math.floor((new Date(c.end_date).getTime() - now.getTime()) / 86_400_000);
        return days <= RENEWAL_WINDOW_DAYS;
    });
    if (expiringContract) return 'renovable';

    // ¿Contrato activo?
    if (activeContracts.length > 0) return 'activa';

    // ¿ATR en curso? (con propuesta aceptada)
    const atrInProgress = altas.some(a =>
        a.status === 'en_alta' || a.status === 'lista_admin'
    );
    if (atrInProgress && hasAccepted) return 'atr_en_curso';

    // ¿Propuesta aceptada (firmada)?
    if (hasAccepted) return 'firmada';

    // ¿Propuesta enviada?
    const hasSent = proposals.some(p => p.status === 'sent');
    if (hasSent) return 'propuesta_enviada';

    // ¿Propuesta en borrador (factura analizada)?
    const hasDraft = proposals.some(p => p.status === 'draft');
    if (hasDraft) return 'factura_analizada';

    return 'lead';
}

/**
 * Versión batch: agrupa clientes por etapa energética.
 * Recibe un mapa de clientId → EnergyStageInput y devuelve clientId → EnergyStage.
 */
export function computeEnergyStagesBatch(
    inputs: Map<string, EnergyStageInput>
): Map<string, EnergyStage> {
    const result = new Map<string, EnergyStage>();
    for (const [clientId, input] of inputs) {
        result.set(clientId, computeEnergyStage(input));
    }
    return result;
}

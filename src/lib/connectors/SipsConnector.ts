import { BaseConnector, type ConnectorConfig, type ConnectorResult } from './BaseConnector';

export interface SipsConsumptionData {
    cups: string;
    annualKwh: number;
    contractedPowerKw: number[];
    distributor: string;
    tariffAccess: string;
    lastReadingDate: string;
}

export class SipsConnector extends BaseConnector {
    constructor(config?: Partial<ConnectorConfig>) {
        super('SIPS', {
            baseUrl: process.env.SIPS_API_URL ?? 'https://api.cnmc.es/sips/v1',
            apiKey: process.env.SIPS_API_KEY,
            timeoutMs: 15_000,
            ...config,
        });
    }

    async getConsumptionByCups(cups: string): Promise<ConnectorResult<SipsConsumptionData>> {
        if (!cups || cups.length < 20) {
            return { success: false, error: 'CUPS inválido: debe tener al menos 20 caracteres' };
        }

        return this.fetchWithRetry<SipsConsumptionData>(`/consumption/${encodeURIComponent(cups)}`);
    }
}

let _instance: SipsConnector | null = null;

export function getSipsConnector(): SipsConnector {
    if (!_instance) {
        _instance = new SipsConnector();
    }
    return _instance;
}

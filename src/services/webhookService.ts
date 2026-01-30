import { InvoiceData, SavingsResult, TariffPrice } from '@/types/crm';

// Note: Webhook operations are now handled via secure Server Actions
// to protect API keys from exposure in the browser.

import { analyzeDocumentAction } from '@/app/actions/ocr';

/**
 * Secure document analysis using Server Action (Hidden API Key)
 */
export async function analyzeDocument(file: File): Promise<InvoiceData> {
    const formData = new FormData();
    formData.append('file', file);

    try {
        return await analyzeDocumentAction(formData);
    } catch (error) {
        console.error('Document analysis error:', error);
        throw error;
    }
}

import { calculateSavingsAction } from '@/app/actions/compare';

/**
 * Secure tariff comparison with validation
 */
export async function calculateSavings(invoice: InvoiceData): Promise<SavingsResult[]> {
    try {
        const data = await calculateSavingsAction(invoice);
        const currentCost = data.current_annual_cost || 0;

        interface WebhookOffer {
            id: string;
            marketer_name: string;
            tariff_name: string;
            logo_color?: string;
            type?: 'fixed' | 'indexed';
            power_price: TariffPrice;
            energy_price: TariffPrice;
            fixed_fee?: number;
            contract_duration: string;
            annual_cost?: number;
            optimization_result?: unknown;
        }

        return (data.offers as WebhookOffer[]).map((offer) => ({
            offer: {
                id: offer.id,
                marketer_name: offer.marketer_name,
                tariff_name: offer.tariff_name,
                logo_color: offer.logo_color || 'bg-blue-600',
                type: offer.type,
                power_price: offer.power_price,
                energy_price: offer.energy_price,
                fixed_fee: offer.fixed_fee,
                contract_duration: offer.contract_duration,
            },
            current_annual_cost: currentCost,
            offer_annual_cost: offer.annual_cost || 0,
            annual_savings: Math.max(0, currentCost - (offer.annual_cost || 0)),
            savings_percent: currentCost > 0 ? ((currentCost - (offer.annual_cost || 0)) / currentCost) * 100 : 0,
            optimization_result: offer.optimization_result as SavingsResult['optimization_result'],
        }));
    } catch (error) {
        console.error('Tariff comparison error:', error);

        // Return mock data ONLY in development mode
        if (process.env.NODE_ENV === 'development') {
            console.warn('Using mock data in development mode');
            const currentCost = invoice.total_amount || 1200;

            return [
                {
                    offer: {
                        id: 'mock-offer-1',
                        marketer_name: 'Energía Plus',
                        tariff_name: 'Tarifa Optimizada 2.0TD',
                        logo_color: 'bg-emerald-600',
                        type: 'fixed' as const,
                        power_price: { p1: 0.045, p2: 0.045, p3: 0, p4: 0, p5: 0, p6: 0 },
                        energy_price: { p1: 0.22, p2: 0.18, p3: 0, p4: 0, p5: 0, p6: 0 },
                        fixed_fee: 35,
                        contract_duration: '12 meses',
                    },
                    current_annual_cost: currentCost,
                    offer_annual_cost: currentCost * 0.85,
                    annual_savings: currentCost * 0.15,
                    savings_percent: 15,
                    optimization_result: undefined,
                },
                {
                    offer: {
                        id: 'mock-offer-2',
                        marketer_name: 'Luz Directa',
                        tariff_name: 'Tarifa Verde 24h',
                        logo_color: 'bg-blue-600',
                        type: 'fixed' as const,
                        power_price: { p1: 0.04, p2: 0.04, p3: 0, p4: 0, p5: 0, p6: 0 },
                        energy_price: { p1: 0.20, p2: 0.20, p3: 0, p4: 0, p5: 0, p6: 0 },
                        fixed_fee: 28,
                        contract_duration: '12 meses',
                    },
                    current_annual_cost: currentCost,
                    offer_annual_cost: currentCost * 0.92,
                    annual_savings: currentCost * 0.08,
                    savings_percent: 8,
                    optimization_result: undefined,
                },
            ];
        }

        throw error;
    }
}

/**
 * Validate file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ['application/pdf'];

    if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, error: 'Solo se permiten archivos PDF' };
    }

    if (file.size > MAX_SIZE) {
        return { valid: false, error: 'El archivo excede 10MB' };
    }

    return { valid: true };
}

/**
 * Generate API key for webhook authentication
 */
export function generateAPIKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

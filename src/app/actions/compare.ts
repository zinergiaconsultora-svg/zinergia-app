'use server';

import { InvoiceData } from '@/types/crm';
import { env } from '@/lib/env';

export async function calculateSavingsAction(invoice: InvoiceData) {
    const COMPARISON_WEBHOOK_URL = env.COMPARISON_WEBHOOK_URL;
    const WEBHOOK_API_KEY = env.WEBHOOK_API_KEY;

    // Diagnostic Logging for Vercel
    console.log('[Compare Action] Starting savings calculation');
    console.log('[Compare Action] Environment Configuration:', {
        COMPARISON_WEBHOOK_URL: 'Defined',
        WEBHOOK_API_KEY: 'Defined',
    });

    try {
        const response = await fetch(COMPARISON_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': WEBHOOK_API_KEY,
            },
            body: JSON.stringify(invoice),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Comparison API error response:', errorText);
            throw new Error(`Comparison failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Server Action Comparison Error:', error);
        throw error;
    }
}

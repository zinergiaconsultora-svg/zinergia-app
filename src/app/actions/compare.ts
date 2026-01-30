'use server';

import { InvoiceData } from '@/types/crm';

const COMPARE_WEBHOOK_URL = process.env.COMPARISON_WEBHOOK_URL || process.env.COMPARE_WEBHOOK_URL;
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;

export async function calculateSavingsAction(invoice: InvoiceData) {
    // Diagnostic Logging for Vercel
    console.log('[Compare Action] Starting savings calculation');
    console.log('[Compare Action] Environment Configuration:', {
        COMPARE_WEBHOOK_URL: COMPARE_WEBHOOK_URL ? 'Defined' : 'MISSING',
        WEBHOOK_API_KEY: WEBHOOK_API_KEY ? 'Defined' : 'MISSING',
    });

    if (!COMPARE_WEBHOOK_URL) {
        throw new Error('SERVER ERROR: COMPARE_WEBHOOK_URL is not configured');
    }

    try {
        const response = await fetch(COMPARE_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(WEBHOOK_API_KEY ? { 'x-api-key': WEBHOOK_API_KEY } : {}),
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

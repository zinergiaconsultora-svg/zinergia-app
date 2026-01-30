'use server';

import { InvoiceData } from '@/types/crm';

const COMPARE_WEBHOOK_URL = process.env.COMPARE_WEBHOOK_URL;
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;

export async function calculateSavingsAction(invoice: InvoiceData) {
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

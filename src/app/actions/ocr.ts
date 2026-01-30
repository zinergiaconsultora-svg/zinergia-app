'use server';

import { InvoiceData } from '@/types/crm';

export async function analyzeDocumentAction(formData: FormData): Promise<InvoiceData> {
    // Read environment variables INSIDE the function (not at module level)
    const OCR_WEBHOOK_URL = process.env.OCR_WEBHOOK_URL;
    const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;

    console.log('[OCR Action] Starting document analysis');
    console.log('[OCR Action] Environment check:', {
        hasOCR_URL: !!process.env.OCR_WEBHOOK_URL,
        hasAPIKey: !!process.env.WEBHOOK_API_KEY,
        nodeEnv: process.env.NODE_ENV
    });

    if (!OCR_WEBHOOK_URL) {
        console.error('[OCR Action] OCR_WEBHOOK_URL not configured');
        throw new Error('SERVER ERROR: OCR_WEBHOOK_URL is not configured');
    }

    try {
        const file = formData.get('file') as File;
        if (!file) {
            throw new Error('No file provided');
        }

        console.log('[OCR Action] File received:', { name: file.name, size: file.size, type: file.type });

        const response = await fetch(OCR_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                ...(WEBHOOK_API_KEY ? { 'x-api-key': WEBHOOK_API_KEY } : {}),
            },
            body: formData,
        });

        console.log('[OCR Action] Webhook response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OCR Action] Webhook error:', errorText);
            throw new Error(`OCR Processing failed: ${response.statusText} - ${errorText}`);
        }

        const responseData = await response.json();

        // Use the same normalization logic as in the route.ts
        const data = Array.isArray(responseData) ? responseData[0]?.output || responseData[0] : responseData?.output || responseData;

        if (!data) {
            throw new Error('Invalid response from OCR service');
        }

        const parseNumber = (value: any) => {
            if (!value) return 0;
            const strValue = String(value).replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(strValue);
            return isNaN(parsed) ? 0 : parsed;
        };

        // Normalized result (matching your existing structure)
        return {
            client_name: data.client_name || data.CLIENTE_NOMBRE || data.cliente_nombre || 'Cliente Desconocido',
            dni_cif: data.dni_cif || data.nif_cif || '',
            company_name: data.company_name || data.COMERCIALIZADORA || data.compania || '',
            cups: data.cups || data.CUPS || '',
            tariff_name: data.tariff_name || data.TARIFA || data.tarifa || '',
            invoice_number: data.invoice_number || data.NUMERO_FACTURA || data.numero_factura || '',
            invoice_date: data.invoice_date || data.FECHA_FACTURA || data.fecha_factura || '',
            period_days: parseNumber(data.period_days || data.periodo_facturacion),
            supply_address: data.supply_address || data.direccion_suministro || '',
            subtotal: parseNumber(data.subtotal),
            vat: parseNumber(data.iva),
            total_amount: parseNumber(data.importe_total || data.total),
            rights_cost: parseNumber(data.derechos_enganche),

            power_p1: parseNumber(data.power_p1 || data.POTENCIA_P1 || data.potencia_p1),
            power_p2: parseNumber(data.power_p2 || data.POTENCIA_P2 || data.potencia_p2),
            power_p3: parseNumber(data.power_p3 || data.POTENCIA_P3 || data.potencia_p3),
            power_p4: parseNumber(data.power_p4 || data.POTENCIA_P4 || data.potencia_p4),
            power_p5: parseNumber(data.power_p5 || data.POTENCIA_P5 || data.potencia_p5),
            power_p6: parseNumber(data.power_p6 || data.POTENCIA_P6 || data.potencia_p6),

            energy_p1: parseNumber(data.energy_p1 || data.ENERGIA_P1 || data.energia_p1),
            energy_p2: parseNumber(data.energy_p2 || data.ENERGIA_P2 || data.energia_p2),
            energy_p3: parseNumber(data.energy_p3 || data.ENERGIA_P3 || data.energia_p3),
            energy_p4: parseNumber(data.energy_p4 || data.ENERGIA_P4 || data.energia_p4),
            energy_p5: parseNumber(data.energy_p5 || data.ENERGIA_P5 || data.energia_p5),
            energy_p6: parseNumber(data.energy_p6 || data.ENERGIA_P6 || data.energia_p6),
        } as InvoiceData;

    } catch (error) {
        console.error('Server Action OCR Error:', error);
        throw error;
    }
}

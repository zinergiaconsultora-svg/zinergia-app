'use server';

import { InvoiceData } from '@/types/crm';
import { env } from '@/lib/env';

export async function analyzeDocumentAction(formData: FormData): Promise<InvoiceData> {
    const OCR_WEBHOOK_URL = env.OCR_WEBHOOK_URL;
    const WEBHOOK_API_KEY = env.WEBHOOK_API_KEY;

    console.log('[OCR Action] Starting document analysis');

    // Diagnostic Logging for Vercel
    const envCheck = {
        OCR_WEBHOOK_URL: 'Defined (Length: ' + OCR_WEBHOOK_URL.length + ')',
        WEBHOOK_API_KEY: 'Defined',
        NODE_ENV: env.NODE_ENV,
    };
    console.log('[OCR Action] Environment Configuration:', JSON.stringify(envCheck, null, 2));

    try {
        const file = formData.get('file') as File;
        if (!file) {
            throw new Error('No file provided');
        }

        console.log('[OCR Action] File received:', { name: file.name, size: file.size, type: file.type });

        const response = await fetch(OCR_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'x-api-key': WEBHOOK_API_KEY,
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

        const parseNumber = (value: unknown) => {
            if (value === undefined || value === null || value === '') return 0;
            // Handle Spanish format: 1.234,56
            const strValue = String(value).trim().replace(/\s/g, '');
            // If it has both . and , (e.g. 1.234,56)
            if (strValue.includes('.') && strValue.includes(',')) {
                return parseFloat(strValue.replace(/\./g, '').replace(',', '.'));
            }
            // If it only has , (e.g. 1234,56)
            if (strValue.includes(',')) {
                return parseFloat(strValue.replace(',', '.'));
            }
            return parseFloat(strValue) || 0;
        };

        const rawTariff = (data.tariff_name || data.TARIFA || data.tarifa || data.ACCESO || '').toUpperCase();

        // Accurate Power Type Detection
        let detectedPowerType = '2.0';
        if (rawTariff.includes('3.1') || rawTariff.includes('6.1') || rawTariff.includes('6.2')) {
            detectedPowerType = '3.1';
        } else if (rawTariff.includes('3.0') || rawTariff.includes('3.0TD')) {
            detectedPowerType = '3.0';
        } else if (rawTariff.includes('2.0') || rawTariff.includes('2.1') || rawTariff.includes('2.0TD')) {
            detectedPowerType = '2.0';
        }

        // Normalized result (matching your existing structure)
        return {
            client_name: data.client_name || data.CLIENTE_NOMBRE || data.cliente_nombre || data.TITULAR || 'Cliente Desconocido',
            dni_cif: data.dni_cif || data.nif_cif || data.CIF_NIF || data.NIF || '',
            company_name: data.company_name || data.COMERCIALIZADORA || data.compania || data.EMPRESA || '',
            cups: data.cups || data.CUPS || data.cups_suministro || '',
            tariff_name: rawTariff || '2.0TD',
            invoice_number: data.invoice_number || data.NUMERO_FACTURA || data.numero_factura || data.N_FACTURA || '',
            invoice_date: data.invoice_date || data.FECHA_FACTURA || data.fecha_factura || data.FECHA_EMISION || '',
            period_days: parseNumber(data.period_days || data.periodo_facturacion || data.DIAS_FACTURACION || 30),
            supply_address: data.supply_address || data.direccion_suministro || data.DIRECCION || '',
            subtotal: parseNumber(data.subtotal || data.SUBTOTAL),
            vat: parseNumber(data.iva || data.IVA),
            total_amount: parseNumber(data.importe_total || data.total || data.TOTAL_FACTURA),
            rights_cost: parseNumber(data.derechos_enganche || data.DERECHOS),

            power_p1: parseNumber(data.power_p1 || data.POTENCIA_P1 || data.potencia_p1 || data.P1_KW),
            power_p2: parseNumber(data.power_p2 || data.POTENCIA_P2 || data.potencia_p2 || data.P2_KW),
            power_p3: parseNumber(data.power_p3 || data.POTENCIA_P3 || data.potencia_p3 || data.P3_KW),
            power_p4: parseNumber(data.power_p4 || data.POTENCIA_P4 || data.potencia_p4 || data.P4_KW),
            power_p5: parseNumber(data.power_p5 || data.POTENCIA_P5 || data.potencia_p5 || data.P5_KW),
            power_p6: parseNumber(data.power_p6 || data.POTENCIA_P6 || data.potencia_p6 || data.P6_KW),

            energy_p1: parseNumber(data.energy_p1 || data.ENERGIA_P1 || data.energia_p1 || data.P1_KWH),
            energy_p2: parseNumber(data.energy_p2 || data.ENERGIA_P2 || data.energia_p2 || data.P2_KWH),
            energy_p3: parseNumber(data.energy_p3 || data.ENERGIA_P3 || data.energia_p3 || data.P3_KWH),
            energy_p4: parseNumber(data.energy_p4 || data.ENERGIA_P4 || data.energia_p4 || data.P4_KWH),
            energy_p5: parseNumber(data.energy_p5 || data.ENERGIA_P5 || data.energia_p5 || data.P5_KWH),
            energy_p6: parseNumber(data.energy_p6 || data.ENERGIA_P6 || data.energia_p6 || data.P6_KWH),

            detected_power_type: detectedPowerType
        } as InvoiceData;

    } catch (error) {
        console.error('Server Action OCR Error:', error);

        // Mock data fallback for development
        if (env.NODE_ENV === 'development') {
            console.warn('⚠️ OCR Webhook failed. Using MOCK data for development.');
            return {
                client_name: 'Empresa Mock S.L.',
                dni_cif: 'B12345678',
                company_name: 'Comercializadora Mock',
                cups: 'ES0021000000000000XX',
                tariff_name: '2.0TD',
                invoice_number: 'FACT-2024-001',
                invoice_date: new Date().toISOString().split('T')[0],
                period_days: 30,
                supply_address: 'Calle Falsa 123, Madrid',
                subtotal: 100.00,
                vat: 21.00,
                total_amount: 121.00,
                rights_cost: 0,
                power_p1: 4.6, power_p2: 4.6, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
                energy_p1: 150, energy_p2: 100, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
            } as InvoiceData;
        }

        throw error;
    }
}

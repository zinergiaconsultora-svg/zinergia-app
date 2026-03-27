import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(request: Request) {
    // 1. Authenticate N8N Request
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== env.WEBHOOK_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = await request.json();
        const { job_id, status, data, error } = payload;

        if (!job_id) {
            return NextResponse.json({ error: 'Missing job_id' }, { status: 400 });
        }

        // Validar que el status sea un valor permitido por la constraint de la DB
        const VALID_STATUSES = ['completed', 'failed'] as const;
        if (!status || !VALID_STATUSES.includes(status)) {
            return NextResponse.json({ error: `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
        }

        // Initialize Supabase Admin Client to bypass RLS for this backend operation
        const supabaseAdmin = createClient(
            env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Normalize data if success
        let invoiceData = null;
        if (status === 'completed' && data) {
            const rawData = Array.isArray(data) ? data[0]?.output || data[0] : data?.output || data;
            
            const parseNumber = (value: unknown) => {
                if (value === undefined || value === null || value === '') return 0;
                const strValue = String(value).trim().replace(/\s/g, '');
                if (strValue.includes('.') && strValue.includes(',')) {
                    return parseFloat(strValue.replace(/\./g, '').replace(',', '.'));
                }
                if (strValue.includes(',')) {
                    return parseFloat(strValue.replace(',', '.'));
                }
                return parseFloat(strValue) || 0;
            };

            const rawTariff = (rawData.tariff_name || rawData.TARIFA || rawData.tarifa || rawData.ACCESO || '').toUpperCase();
            
            let detectedPowerType = '2.0';
            if (rawTariff.includes('3.1') || rawTariff.includes('6.1') || rawTariff.includes('6.2')) {
                detectedPowerType = '3.1';
            } else if (rawTariff.includes('3.0') || rawTariff.includes('3.0TD')) {
                detectedPowerType = '3.0';
            } else if (rawTariff.includes('2.0') || rawTariff.includes('2.1') || rawTariff.includes('2.0TD')) {
                detectedPowerType = '2.0';
            }

            invoiceData = {
                client_name: rawData.client_name || rawData.CLIENTE_NOMBRE || rawData.cliente_nombre || rawData.TITULAR || 'Cliente Desconocido',
                dni_cif: rawData.dni_cif || rawData.nif_cif || rawData.CIF_NIF || rawData.NIF || '',
                company_name: rawData.company_name || rawData.COMERCIALIZADORA || rawData.compania || rawData.EMPRESA || '',
                cups: rawData.cups || rawData.CUPS || rawData.cups_suministro || '',
                tariff_name: rawTariff || '2.0TD',
                invoice_number: rawData.invoice_number || rawData.NUMERO_FACTURA || rawData.numero_factura || rawData.N_FACTURA || '',
                invoice_date: rawData.invoice_date || rawData.FECHA_FACTURA || rawData.fecha_factura || rawData.FECHA_EMISION || '',
                period_days: parseNumber(rawData.period_days || rawData.periodo_facturacion || rawData.DIAS_FACTURACION || 30),
                supply_address: rawData.supply_address || rawData.direccion_suministro || rawData.DIRECCION || '',
                subtotal: parseNumber(rawData.subtotal || rawData.SUBTOTAL),
                vat: parseNumber(rawData.iva || rawData.IVA),
                total_amount: parseNumber(rawData.importe_total || rawData.total || rawData.TOTAL_FACTURA),
                rights_cost: parseNumber(rawData.derechos_enganche || rawData.DERECHOS),

                power_p1: parseNumber(rawData.power_p1 || rawData.POTENCIA_P1 || rawData.potencia_p1 || rawData.P1_KW),
                power_p2: parseNumber(rawData.power_p2 || rawData.POTENCIA_P2 || rawData.potencia_p2 || rawData.P2_KW),
                power_p3: parseNumber(rawData.power_p3 || rawData.POTENCIA_P3 || rawData.potencia_p3 || rawData.P3_KW),
                power_p4: parseNumber(rawData.power_p4 || rawData.POTENCIA_P4 || rawData.potencia_p4 || rawData.P4_KW),
                power_p5: parseNumber(rawData.power_p5 || rawData.POTENCIA_P5 || rawData.potencia_p5 || rawData.P5_KW),
                power_p6: parseNumber(rawData.power_p6 || rawData.POTENCIA_P6 || rawData.potencia_p6 || rawData.P6_KW),

                energy_p1: parseNumber(rawData.energy_p1 || rawData.ENERGIA_P1 || rawData.energia_p1 || rawData.P1_KWH),
                energy_p2: parseNumber(rawData.energy_p2 || rawData.ENERGIA_P2 || rawData.energia_p2 || rawData.P2_KWH),
                energy_p3: parseNumber(rawData.energy_p3 || rawData.ENERGIA_P3 || rawData.energia_p3 || rawData.P3_KWH),
                energy_p4: parseNumber(rawData.energy_p4 || rawData.ENERGIA_P4 || rawData.energia_p4 || rawData.P4_KWH),
                energy_p5: parseNumber(rawData.energy_p5 || rawData.ENERGIA_P5 || rawData.energia_p5 || rawData.P5_KWH),
                energy_p6: parseNumber(rawData.energy_p6 || rawData.ENERGIA_P6 || rawData.energia_p6 || rawData.P6_KWH),

                detected_power_type: detectedPowerType
            };
        }

        // Update Job Status
        const updatePayload: Record<string, unknown> = { status };
        if (invoiceData) updatePayload.invoice_data = invoiceData;
        if (error) updatePayload.error_message = error;

        const { error: dbError } = await supabaseAdmin
            .from('ocr_jobs')
            .update(updatePayload)
            .eq('id', job_id);

        if (dbError) {
            console.error('[OCR Callback] DB Update Error:', dbError);
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Job updated successfully' });

    } catch (error) {
        console.error('[OCR Callback] Parsing Error:', error);
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
}

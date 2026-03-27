'use server';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { InvoiceData } from '@/types/crm';

export async function analyzeDocumentAction(formData: FormData): Promise<{ jobId: string; isMock: boolean; data?: InvoiceData }> {
    const OCR_WEBHOOK_URL = env.OCR_WEBHOOK_URL;
    const WEBHOOK_API_KEY = env.WEBHOOK_API_KEY;

    if (!OCR_WEBHOOK_URL || !WEBHOOK_API_KEY) {
        throw new Error('Variables de entorno de OCR no definidas');
    }

    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No se ha proporcionado archivo');
    }

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('No estás autenticado');
        }

        // 1. Obtener la franquicia del usuario para el registro del Job
        const { data: profile } = await supabase.from('profiles').select('franchise_id').eq('id', user.id).single();
        const franchiseId = profile?.franchise_id;

        // 2. Crear el Job en la DB
        const { data: job, error: jobError } = await supabase.from('ocr_jobs').insert({
            user_id: user.id,
            franchise_id: franchiseId,
            status: 'processing'
        }).select('id').single();

        if (jobError || !job) {
            throw new Error('Fallo al crear el trabajo de OCR en la base de datos');
        }

        // 3. Añadir el jobId al FormData para N8N
        formData.append('job_id', job.id);

        // 4. Enviar a N8N de forma paralela (fire-and-forget simulado enviando la request y devolviendo el jobId rápido sin esperar a que el servidor de N8N acabe todo el procesamiento si está configurado en "Respond immediately")
        const response = await fetch(OCR_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'x-api-key': WEBHOOK_API_KEY,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OCR Action] Webhook error:', errorText);
            
            // Marcar el job como fallido si N8N rechaza directamente
            await supabase.from('ocr_jobs').update({ status: 'failed', error_message: errorText }).eq('id', job.id);
            throw new Error(`Fallo de conexión OCR: ${response.statusText}`);
        }

        // N8N debería estar configurado con "Respond: Immediately". 
        // Ya no parseamos el resultado aquí. Simplemente devolvemos el Job ID.
        return { jobId: job.id, isMock: false };

    } catch (error) {
        if (env.NODE_ENV === 'development') {
            console.warn('⚠️ OCR Webhook failed. Using MOCK data for development.', error);
            // Mock MODO ASÍNCRONO DE DESARROLLO
            // Retornamos un "mock job_id" especial que el frontend detectará
            return {
                jobId: 'MOCK-JOB',
                isMock: true,
                data: {
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
                    detected_power_type: '2.0'
                } as InvoiceData
            };
        }

        console.error('[OCR] Error:', error);
        throw new Error('No se ha podido enviar la factura para su procesamiento.');
    }
}

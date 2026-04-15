'use server';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { InvoiceData } from '@/types/crm';
import {
    ALLOWED_TYPES,
    MAX_FILE_SIZE,
    MOCK_INVOICE_DATA,
    extractSyncDataFromResponse,
    postOcrToN8n,
} from '@/lib/ocr/dispatch';

/**
 * Sube el archivo a Supabase Storage y devuelve la URL firmada (válida 7 días).
 * El path usa userId como prefijo para cumplir con las RLS del bucket.
 */
async function uploadToStorage(
    supabase: Awaited<ReturnType<typeof createClient>>,
    file: File,
    userId: string
): Promise<string | null> {
    try {
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error } = await supabase.storage
            .from('ocr-invoices')
            .upload(path, file, { contentType: file.type, upsert: false });

        if (error) {
            console.warn('[OCR] Storage upload failed (non-blocking):', error.message);
            return null;
        }

        const { data } = await supabase.storage
            .from('ocr-invoices')
            .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 días

        return data?.signedUrl ?? null;
    } catch (e) {
        console.warn('[OCR] Storage upload exception (non-blocking):', e);
        return null;
    }
}

/**
 * Variante URL-based de analyzeDocumentAction.
 * Recibe una URL firmada de Supabase (subida directamente desde el cliente),
 * descarga el archivo en el servidor, y lo envía a N8N exactamente igual.
 *
 * Ventaja: el binario del PDF nunca pasa por el body de la server action,
 * eliminando el límite de tamaño (~1MB) que causaba "unexpected server response".
 */
export async function analyzeDocumentByUrlAction(
    fileUrl: string,
    fileName: string,
    fileType: string,
    rawText?: string,
): Promise<{ jobId: string; isMock: boolean; data?: InvoiceData }> {
    const OCR_WEBHOOK_URL = env.OCR_WEBHOOK_URL;
    const WEBHOOK_API_KEY = env.WEBHOOK_API_KEY;

    if (!OCR_WEBHOOK_URL || !WEBHOOK_API_KEY) {
        throw new Error('Variables de entorno de OCR no definidas');
    }

    if (!ALLOWED_TYPES.includes(fileType)) {
        throw new Error(`Formato no soportado: ${fileType}. Usa PDF, JPG, PNG o WEBP.`);
    }

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No estás autenticado');

        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id')
            .eq('id', user.id)
            .single();
        const franchiseId = profile?.franchise_id;

        // Create OCR job — file is already in storage (URL provided by client)
        const { data: job, error: jobError } = await supabase
            .from('ocr_jobs')
            .insert({
                agent_id: user.id,
                franchise_id: franchiseId,
                status: 'processing',
                file_name: fileName,
                file_path: fileUrl,
                attempts: 1,
            })
            .select('id')
            .single();

        if (jobError || !job) {
            throw new Error('Fallo al crear el trabajo de OCR en la base de datos');
        }

        // Download file from the signed URL (server→Supabase, fast within same infra)
        // This keeps the N8N flow unchanged — N8N still receives the binary FormData.
        const fileResponse = await fetch(fileUrl, { cache: 'no-store' });
        if (!fileResponse.ok) {
            throw new Error(`No se pudo descargar el archivo para su procesamiento (${fileResponse.status})`);
        }
        const blob = await fileResponse.blob();
        const file = new File([blob], fileName, { type: fileType });

        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`El archivo supera el límite de 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
        }

        const response = await postOcrToN8n({
            webhookUrl: OCR_WEBHOOK_URL,
            apiKey: WEBHOOK_API_KEY,
            file,
            jobId: job.id,
            rawText,
        });

        const validatedData = await extractSyncDataFromResponse(response);
        if (validatedData) {
            await supabase.from('ocr_jobs')
                .update({ status: 'completed', extracted_data: validatedData })
                .eq('id', job.id);
            return { jobId: job.id, isMock: false, data: validatedData as unknown as InvoiceData };
        }

        return { jobId: job.id, isMock: false };

    } catch (error) {
        if (env.NODE_ENV === 'development') {
            console.warn('⚠️ OCR (URL) Webhook failed. Using MOCK data for development.', error);
            return { jobId: 'MOCK-JOB', isMock: true, data: MOCK_INVOICE_DATA };
        }
        console.error('[OCR] Error (URL flow) tras reintentos:', error);
        throw new Error('No se ha podido enviar la factura para su procesamiento.');
    }
}

export async function analyzeDocumentAction(formData: FormData): Promise<{ jobId: string; isMock: boolean; data?: InvoiceData }> {
    const OCR_WEBHOOK_URL = env.OCR_WEBHOOK_URL;
    const WEBHOOK_API_KEY = env.WEBHOOK_API_KEY;

    if (!OCR_WEBHOOK_URL || !WEBHOOK_API_KEY) {
        throw new Error('Variables de entorno de OCR no definidas');
    }

    const file = formData.get('file') as File;
    if (!file) throw new Error('No se ha proporcionado archivo');

    // Validación temprana: tipo y tamaño
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Formato no soportado: ${file.type}. Usa PDF, JPG, PNG o WEBP.`);
    }
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`El archivo supera el límite de 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
    }

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('No estás autenticado');

        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id')
            .eq('id', user.id)
            .single();
        const franchiseId = profile?.franchise_id;

        // Subir a Storage para habilitar retry real (no bloquea el flujo principal)
        const fileUrl = await uploadToStorage(supabase, file, user.id);

        // Crear el Job en la DB
        const { data: job, error: jobError } = await supabase
            .from('ocr_jobs')
            .insert({
                agent_id: user.id,
                franchise_id: franchiseId,
                status: 'processing',
                file_name: file.name,
                file_path: fileUrl,
                attempts: 1,
            })
            .select('id')
            .single();

        if (jobError || !job) {
            throw new Error('Fallo al crear el trabajo de OCR en la base de datos');
        }

        const response = await postOcrToN8n({
            webhookUrl: OCR_WEBHOOK_URL,
            apiKey: WEBHOOK_API_KEY,
            file,
            jobId: job.id,
        });

        const validatedData = await extractSyncDataFromResponse(response);
        if (validatedData) {
            await supabase.from('ocr_jobs')
                .update({ status: 'completed', extracted_data: validatedData })
                .eq('id', job.id);
            return { jobId: job.id, isMock: false, data: validatedData as unknown as InvoiceData };
        }

        // Flujo asíncrono: N8N procesará y llamará al callback
        return { jobId: job.id, isMock: false };

    } catch (error) {
        if (env.NODE_ENV === 'development') {
            console.warn('⚠️ OCR Webhook failed. Using MOCK data for development.', error);
            return { jobId: 'MOCK-JOB', isMock: true, data: MOCK_INVOICE_DATA };
        }

        console.error('[OCR] Error tras reintentos:', error);
        throw new Error('No se ha podido enviar la factura para su procesamiento tras múltiples intentos.');
    }
}

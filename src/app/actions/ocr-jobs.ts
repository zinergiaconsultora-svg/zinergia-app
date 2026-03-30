'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { env } from '@/lib/env';

export interface OcrJobRecord {
    id: string;
    status: 'processing' | 'completed' | 'failed';
    created_at: string;
    file_name: string | null;
    file_path: string | null;
    extracted_data: Record<string, unknown> | null;
    error_message: string | null;
    attempts: number;
    client_id?: string | null;
}

export async function getOcrJobHistory(limit = 20): Promise<OcrJobRecord[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('id, status, created_at, file_name, file_path, extracted_data, error_message, attempts')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Error obteniendo historial OCR: ${error.message}`);
    return (data ?? []) as OcrJobRecord[];
}

export async function getOcrJobStatus(jobId: string): Promise<OcrJobRecord | null> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('id, status, created_at, file_name, file_path, extracted_data, error_message, attempts')
        .eq('id', jobId)
        .single();

    if (error) return null;
    return data as OcrJobRecord;
}

export async function getOcrJobsByClient(clientId: string, limit = 20): Promise<OcrJobRecord[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('id, status, created_at, file_name, file_path, extracted_data, error_message, attempts, client_id')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Error obteniendo historial de facturas: ${error.message}`);
    return (data ?? []) as OcrJobRecord[];
}

export async function markOcrJobFailed(jobId: string, reason: string): Promise<void> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Only allow marking own jobs
    const { error } = await supabase
        .from('ocr_jobs')
        .update({ status: 'failed', error_message: reason })
        .eq('id', jobId)
        .eq('agent_id', user.id)
        .eq('status', 'processing'); // Safety: only update if still stuck
    if (error) {
        console.error(`[OCR] markOcrJobFailed DB error for job ${jobId}:`, error.message);
        throw new Error(`Error al marcar job como fallido: ${error.message}`);
    }
}

export async function retryOcrJob(jobId: string): Promise<{ success: boolean; message: string }> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();

    const { data: job, error } = await supabase
        .from('ocr_jobs')
        .select('id, status, attempts, file_name, file_path')
        .eq('id', jobId)
        .single();

    if (error || !job) return { success: false, message: 'Job no encontrado' };
    if (job.status !== 'failed') return { success: false, message: 'Solo se pueden reintentar jobs fallidos' };
    if ((job.attempts ?? 0) >= 5) return { success: false, message: 'Máximo de reintentos alcanzado (5)' };

    const OCR_WEBHOOK_URL = env.OCR_WEBHOOK_URL;
    const WEBHOOK_API_KEY = env.WEBHOOK_API_KEY;

    // Si tenemos file_path, descargar y reenviar a N8N
    if (job.file_path && OCR_WEBHOOK_URL && WEBHOOK_API_KEY) {
        try {
            // Marcar como processing antes de llamar a N8N
            await supabase
                .from('ocr_jobs')
                .update({
                    status: 'processing',
                    error_message: null,
                    attempts: (job.attempts ?? 0) + 1,
                })
                .eq('id', jobId);

            // Regenerar signed URL desde el path de Storage (evita usar URL caducada)
            // Las URLs firmadas de Supabase tienen el path después del bucket: /sign/ocr-invoices/{path}
            const STORAGE_BUCKET = 'ocr-invoices';
            const pathMatch = job.file_path.match(new RegExp(`/sign/${STORAGE_BUCKET}/([^?]+)`));
            let fetchUrl = job.file_path;
            if (pathMatch?.[1]) {
                const { data: freshUrl } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .createSignedUrl(decodeURIComponent(pathMatch[1]), 60 * 5); // 5 min suficiente para el retry
                if (freshUrl?.signedUrl) fetchUrl = freshUrl.signedUrl;
            }

            // Descargar el archivo desde la URL (preferiblemente la URL regenerada)
            const fileResponse = await fetch(fetchUrl);
            if (!fileResponse.ok) {
                // URL expirada o eliminada — marcar como fallido con mensaje claro
                await supabase
                    .from('ocr_jobs')
                    .update({
                        status: 'failed',
                        error_message: 'Archivo original expirado o eliminado. Vuelve a subir la factura.',
                    })
                    .eq('id', jobId);
                return { success: false, message: 'Archivo original expirado. Vuelve a subir la factura.' };
            }

            const blob = await fileResponse.blob();
            const fileName = job.file_name ?? 'factura.pdf';
            const file = new File([blob], fileName, { type: blob.type });

            const formData = new FormData();
            formData.append('file', file);
            formData.append('job_id', jobId);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30_000);

            const webhookResponse = await fetch(OCR_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'x-api-key': WEBHOOK_API_KEY },
                body: formData,
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!webhookResponse.ok) {
                await supabase
                    .from('ocr_jobs')
                    .update({
                        status: 'failed',
                        error_message: `N8N rechazó el retry: HTTP ${webhookResponse.status}`,
                    })
                    .eq('id', jobId);
                return { success: false, message: `N8N rechazó el reintento: ${webhookResponse.status}` };
            }

            return { success: true, message: 'Job re-encolado y reenviado a N8N' };

        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            await supabase
                .from('ocr_jobs')
                .update({ status: 'failed', error_message: `Error en retry: ${msg}` })
                .eq('id', jobId);
            return { success: false, message: `Error al reenviar: ${msg}` };
        }
    }

    // Fallback: sin file_path, solo marcar como processing (N8N no recibirá el archivo)
    const { error: updateError } = await supabase
        .from('ocr_jobs')
        .update({
            status: 'processing',
            error_message: null,
            attempts: (job.attempts ?? 0) + 1,
        })
        .eq('id', jobId);

    if (updateError) return { success: false, message: updateError.message };
    return { success: true, message: 'Job marcado para reprocesamiento (archivo no disponible para reenvío)' };
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';

export interface OcrJobRecord {
    id: string;
    status: 'processing' | 'completed' | 'failed';
    created_at: string;
    file_name: string | null;
    extracted_data: Record<string, unknown> | null;
    error_message: string | null;
    attempts: number;
}

export async function getOcrJobHistory(limit = 20): Promise<OcrJobRecord[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('id, status, created_at, file_name, extracted_data, error_message, attempts')
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
        .select('id, status, created_at, file_name, extracted_data, error_message, attempts')
        .eq('id', jobId)
        .single();

    if (error) return null;
    return data as OcrJobRecord;
}

export async function retryOcrJob(jobId: string): Promise<{ success: boolean; message: string }> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();

    // Solo se puede reintentar un job fallido
    const { data: job, error } = await supabase
        .from('ocr_jobs')
        .select('id, status, attempts')
        .eq('id', jobId)
        .single();

    if (error || !job) return { success: false, message: 'Job no encontrado' };
    if (job.status !== 'failed') return { success: false, message: 'Solo se pueden reintentar jobs fallidos' };
    if ((job.attempts ?? 0) >= 5) return { success: false, message: 'Máximo de reintentos alcanzado (5)' };

    // Marcamos como processing de nuevo para que N8N lo recoja
    const { error: updateError } = await supabase
        .from('ocr_jobs')
        .update({
            status: 'processing',
            error_message: null,
            attempts: (job.attempts ?? 0) + 1,
        })
        .eq('id', jobId);

    if (updateError) return { success: false, message: updateError.message };
    return { success: true, message: 'Job re-encolado para procesamiento' };
}

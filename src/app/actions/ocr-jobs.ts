'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
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
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Use service role to bypass RLS completely
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return null;
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const { data, error } = await admin
        .from('ocr_jobs')
        .select('id, status, created_at, file_name, extracted_data, error_message, attempts')
        .eq('id', jobId)
        .eq('agent_id', user.id)
        .single();

    if (error) return null;
    return data as OcrJobRecord;
}

export async function getOcrJobsByClient(clientId: string, limit = 20): Promise<OcrJobRecord[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    // Verificar que el cliente pertenece al usuario antes de devolver sus facturas
    const { data: client } = await supabase
        .from('clients')
        .select('id, owner_id, franchise_id')
        .eq('id', clientId)
        .single();

    if (!client) throw new Error('Cliente no encontrado');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .single();

    if (!profile) throw new Error('Perfil no encontrado');

    const isAdmin = profile.role === 'admin';
    const isFranchiseOwner = profile.role === 'franchise' && client.franchise_id === profile.franchise_id;
    const isOwner = client.owner_id === user.id;

    if (!isAdmin && !isFranchiseOwner && !isOwner) {
        throw new Error('No autorizado para ver las facturas de este cliente');
    }

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

/**
 * Comprueba si ya existe una factura completada con el mismo CUPS y el mismo mes/año.
 * Devuelve los datos básicos del job previo, o null si no hay duplicado.
 */
export interface PreviousInvoiceComparison {
    invoiceDate: string | null;
    totalEnergyKwh: number;
    totalAmountEur: number | null;
    energyByPeriod: Record<string, number>;
}

/**
 * Busca la factura anterior más reciente del mismo CUPS (excluyendo la fecha actual)
 * y devuelve sus datos de consumo para mostrar el delta al usuario.
 */
export async function getPreviousInvoiceData(
    cups: string,
    currentInvoiceDate: string,
): Promise<PreviousInvoiceComparison | null> {
    if (!cups || cups.length < 18) return null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('extracted_data, created_at')
        .eq('agent_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error || !data) return null;

    // Extraer mes/año de la fecha actual para excluir el mismo período
    const isoMatch = currentInvoiceDate?.match(/(\d{4})-(\d{2})/);
    const dmyMatch = currentInvoiceDate?.match(/\d{2}\/(\d{2})\/(\d{4})/);
    const myMatch  = currentInvoiceDate?.match(/(\d{2})\/(\d{4})/);
    let currentYM: string | null = null;
    if (isoMatch)      currentYM = `${isoMatch[1]}-${isoMatch[2]}`;
    else if (dmyMatch) currentYM = `${dmyMatch[2]}-${dmyMatch[1]}`;
    else if (myMatch)  currentYM = `${myMatch[2]}-${myMatch[1]}`;

    for (const job of data) {
        const ext = job.extracted_data as Record<string, unknown> | null;
        if (!ext) continue;
        const jobCups = String(ext.cups ?? '').trim().toUpperCase();
        if (jobCups !== cups.trim().toUpperCase()) continue;

        // Excluir el mismo mes/año (misma factura que ya estamos analizando)
        const jDate = String(ext.invoice_date ?? '');
        const jIso = jDate.match(/(\d{4})-(\d{2})/);
        const jDmy = jDate.match(/\d{2}\/(\d{2})\/(\d{4})/);
        const jMy  = jDate.match(/(\d{2})\/(\d{4})/);
        let jobYM: string | null = null;
        if (jIso)      jobYM = `${jIso[1]}-${jIso[2]}`;
        else if (jDmy) jobYM = `${jDmy[2]}-${jDmy[1]}`;
        else if (jMy)  jobYM = `${jMy[2]}-${jMy[1]}`;
        if (currentYM && jobYM === currentYM) continue;

        const energyByPeriod: Record<string, number> = {};
        let totalEnergy = 0;
        for (let p = 1; p <= 6; p++) {
            const v = Number(ext[`energy_p${p}`] ?? 0);
            if (v > 0) { energyByPeriod[`p${p}`] = v; totalEnergy += v; }
        }
        if (totalEnergy === 0) continue;

        return {
            invoiceDate: ext.invoice_date ? String(ext.invoice_date) : null,
            totalEnergyKwh: totalEnergy,
            totalAmountEur: ext.total_amount ? Number(ext.total_amount) : null,
            energyByPeriod,
        };
    }

    return null;
}

export async function checkDuplicateInvoice(
    cups: string,
    invoiceDate: string,
): Promise<{ jobId: string; createdAt: string; invoiceNumber: string | null } | null> {
    if (!cups || cups.length < 18) return null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Extraer año y mes de la fecha de factura (formatos: YYYY-MM-DD, DD/MM/YYYY, MM/YYYY)
    let yearMonth: string | null = null;
    const iso = invoiceDate?.match(/(\d{4})-(\d{2})/);
    const dmy = invoiceDate?.match(/\d{2}\/(\d{2})\/(\d{4})/);
    const my  = invoiceDate?.match(/(\d{2})\/(\d{4})/);
    if (iso)      yearMonth = `${iso[1]}-${iso[2]}`;
    else if (dmy) yearMonth = `${dmy[2]}-${dmy[1]}`;
    else if (my)  yearMonth = `${my[2]}-${my[1]}`;

    if (!yearMonth) return null;

    // Buscar jobs completados del mismo agente con el mismo CUPS
    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('id, created_at, extracted_data')
        .eq('agent_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error || !data) return null;

    for (const job of data) {
        const ext = job.extracted_data as Record<string, unknown> | null;
        if (!ext) continue;

        const jobCups = String(ext.cups ?? '').trim().toUpperCase();
        if (jobCups !== cups.trim().toUpperCase()) continue;

        // Mismo CUPS — comprobar si es el mismo mes/año según invoice_date del job
        const jobDate = String(ext.invoice_date ?? '');
        const jIso = jobDate.match(/(\d{4})-(\d{2})/);
        const jDmy = jobDate.match(/\d{2}\/(\d{2})\/(\d{4})/);
        const jMy  = jobDate.match(/(\d{2})\/(\d{4})/);
        let jobYearMonth: string | null = null;
        if (jIso)      jobYearMonth = `${jIso[1]}-${jIso[2]}`;
        else if (jDmy) jobYearMonth = `${jDmy[2]}-${jDmy[1]}`;
        else if (jMy)  jobYearMonth = `${jMy[2]}-${jMy[1]}`;

        if (jobYearMonth === yearMonth) {
            return {
                jobId: job.id,
                createdAt: job.created_at,
                invoiceNumber: ext.invoice_number ? String(ext.invoice_number) : null,
            };
        }
    }

    return null;
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

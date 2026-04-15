'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireServerRole } from '@/lib/auth/permissions';
import { env } from '@/lib/env';
import { postOcrToN8n } from '@/lib/ocr/dispatch';

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

// ── Historial de consumo por CUPS ─────────────────────────────────────────────

export interface CupsEnergyMonth {
    month: string;       // "2024-03"
    totalEnergy: number; // kWh
}

/**
 * Devuelve el consumo total (kWh) mensual de un CUPS de los últimos N meses.
 * Usado para el sparkline histórico en el simulador.
 */
export async function getCupsEnergyHistory(
    cups: string,
    months = 12,
): Promise<CupsEnergyMonth[]> {
    if (!cups || cups.length < 18) return [];

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('extracted_data, created_at')
        .eq('agent_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(60);

    if (error || !data) return [];

    const byMonth: Map<string, number> = new Map();

    for (const job of data) {
        const ext = job.extracted_data as Record<string, unknown> | null;
        if (!ext) continue;
        const jobCups = String(ext.cups ?? '').trim().toUpperCase();
        if (jobCups !== cups.trim().toUpperCase()) continue;

        // Determinar mes/año de la factura
        const jDate = String(ext.invoice_date ?? job.created_at ?? '');
        const isoM = jDate.match(/(\d{4})-(\d{2})/);
        const dmyM = jDate.match(/\d{2}\/(\d{2})\/(\d{4})/);
        const myM  = jDate.match(/(\d{2})\/(\d{4})/);
        let ym: string | null = null;
        if (isoM)      ym = `${isoM[1]}-${isoM[2]}`;
        else if (dmyM) ym = `${dmyM[2]}-${dmyM[1]}`;
        else if (myM)  ym = `${myM[2]}-${myM[1]}`;
        if (!ym) continue;

        let total = 0;
        for (let p = 1; p <= 6; p++) {
            total += Number(ext[`energy_p${p}`] ?? 0);
        }
        if (total <= 0) continue;

        // Guardar solo la primera entrada por mes (la más reciente)
        if (!byMonth.has(ym)) byMonth.set(ym, total);
    }

    // Ordenar cronológicamente y limitar a N meses
    return [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-months)
        .map(([month, totalEnergy]) => ({ month, totalEnergy }));
}

// ── Agent Precision Leaderboard ───────────────────────────────────────────────

export interface AgentLeaderboardEntry {
    agentId: string;
    fullName: string;
    email: string;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    successRate: number;         // 0–1
    validatedCount: number;      // # of jobs where OCR was confirmed
    correctionCount: number;     // # of fields corrected across all jobs
    avgFieldsPerCorrection: number;
}

export async function getAgentPrecisionLeaderboard(): Promise<AgentLeaderboardEntry[]> {
    await requireServerRole(['admin', 'franchise']);

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return [];
    const { createClient: createSupabase } = await import('@supabase/supabase-js');
    const admin = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    // Pull all completed/failed jobs with agent_id
    const { data: jobs, error: jobsErr } = await admin
        .from('ocr_jobs')
        .select('agent_id, status')
        .not('agent_id', 'is', null)
        .in('status', ['completed', 'failed'])
        .limit(5000);

    if (jobsErr || !jobs) return [];

    // Pull validated training examples with agent job link
    const { data: examples } = await admin
        .from('ocr_training_examples')
        .select('ocr_job_id, is_validated, corrected_fields')
        .not('ocr_job_id', 'is', null)
        .eq('is_validated', true)
        .limit(5000);

    // Build a map: ocr_job_id → { validated, fieldCount }
    const examplesByJob = new Map<string, { fieldCount: number }>();
    for (const ex of examples ?? []) {
        if (!ex.ocr_job_id) continue;
        const correctedFields = (ex.corrected_fields as Record<string, unknown> | null) ?? {};
        examplesByJob.set(ex.ocr_job_id, { fieldCount: Object.keys(correctedFields).length });
    }

    // Group jobs by agent_id
    const byAgent = new Map<string, {
        total: number; completed: number; failed: number;
        validatedCount: number; correctionCount: number; totalFieldsSum: number;
    }>();

    for (const job of jobs) {
        const aid = String(job.agent_id);
        if (!byAgent.has(aid)) byAgent.set(aid, { total: 0, completed: 0, failed: 0, validatedCount: 0, correctionCount: 0, totalFieldsSum: 0 });
        const g = byAgent.get(aid)!;
        g.total++;
        if (job.status === 'completed') g.completed++;
        if (job.status === 'failed') g.failed++;
    }

    if (byAgent.size === 0) return [];

    // Fetch agent profiles
    const agentIds = [...byAgent.keys()];
    const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', agentIds);

    const profileMap = new Map<string, { full_name: string | null; email: string }>();
    for (const p of profiles ?? []) profileMap.set(p.id, { full_name: p.full_name, email: p.email });

    // Wire training examples back into agents via job IDs
    // We need agent_id from jobs — build job→agent map
    const jobAgentMap = new Map<string, string>();
    // Re-query with job IDs to link examples → agents
    const { data: jobsWithId } = await admin
        .from('ocr_jobs')
        .select('id, agent_id')
        .not('agent_id', 'is', null)
        .in('status', ['completed'])
        .limit(5000);

    for (const j of jobsWithId ?? []) {
        if (j.id && j.agent_id) jobAgentMap.set(j.id, String(j.agent_id));
    }

    for (const [jobId, ex] of examplesByJob) {
        const aid = jobAgentMap.get(jobId);
        if (!aid || !byAgent.has(aid)) continue;
        const g = byAgent.get(aid)!;
        g.validatedCount++;
        g.correctionCount += ex.fieldCount;
        g.totalFieldsSum += ex.fieldCount;
    }

    return [...byAgent.entries()]
        .map(([agentId, g]) => {
            const profile = profileMap.get(agentId);
            return {
                agentId,
                fullName: profile?.full_name ?? 'Agente desconocido',
                email: profile?.email ?? '',
                totalJobs: g.total,
                completedJobs: g.completed,
                failedJobs: g.failed,
                successRate: g.total > 0 ? g.completed / g.total : 0,
                validatedCount: g.validatedCount,
                correctionCount: g.correctionCount,
                avgFieldsPerCorrection: g.validatedCount > 0 ? g.correctionCount / g.validatedCount : 0,
            };
        })
        .sort((a, b) => b.completedJobs - a.completedJobs || b.successRate - a.successRate);
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

            // Retry path: no automatic re-retries — the user already triggered
            // this manually and we don't want a 9-attempt explosion.
            const webhookResponse = await postOcrToN8n({
                webhookUrl: OCR_WEBHOOK_URL,
                apiKey: WEBHOOK_API_KEY,
                file,
                jobId,
                withRetries: false,
            });

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

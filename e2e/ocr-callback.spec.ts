/**
 * Staging-only OCR callback integration fixture.
 *
 * This validates the commercial handoff after N8N finishes: OCR job completed,
 * client created/linked, selected segment preserved, and no real N8N dependency.
 */

import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from './fixtures/runtime';

const STAGING_PROJECT_REF = 'dnzytocmtmnptndeczny';

interface OcrCallbackEnv {
    supabaseUrl: string;
    serviceKey: string;
    webhookApiKey: string;
    agentEmail: string;
}

interface AgentProfile {
    id: string;
    franchise_id: string;
}

function callbackEnv(): OcrCallbackEnv | null {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const webhookApiKey = process.env.WEBHOOK_API_KEY;
    const agentEmail = process.env.E2E_AGENT_EMAIL;

    if (!supabaseUrl || !serviceKey || !webhookApiKey || !agentEmail) return null;
    if (!supabaseUrl.includes(STAGING_PROJECT_REF)) return null;

    return { supabaseUrl, serviceKey, webhookApiKey, agentEmail };
}

function serviceClient(env: OcrCallbackEnv): SupabaseClient {
    return createClient(env.supabaseUrl, env.serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

async function getAgentProfile(supabase: SupabaseClient, agentEmail: string): Promise<AgentProfile> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, franchise_id')
        .eq('email', agentEmail)
        .maybeSingle();

    if (error) throw error;
    if (!data?.id || !data.franchise_id) throw new Error('E2E agent profile not found or missing franchise_id');
    return data as AgentProfile;
}

async function cleanupFixture(supabase: SupabaseClient, jobId: string, clientId: string | null) {
    await supabase.from('ocr_training_examples').delete().eq('ocr_job_id', jobId);
    await supabase.from('ocr_jobs').update({ client_id: null }).eq('id', jobId);
    await supabase.from('ocr_jobs').delete().eq('id', jobId);
    if (clientId) {
        await supabase.from('clients').delete().eq('id', clientId);
    }
}

test.describe('OCR callback — commercial staging fixture', () => {
    test('completes an OCR job and creates a segmented commercial client', async ({ request }) => {
        const env = callbackEnv();
        if (!env) {
            test.skip(true, 'Requires staging Supabase URL, service role, WEBHOOK_API_KEY and E2E_AGENT_EMAIL.');
            return;
        }

        const supabase = serviceClient(env);
        const profile = await getAgentProfile(supabase, env.agentEmail);
        const jobId = randomUUID();
        let clientId: string | null = null;

        try {
            const { error: insertError } = await supabase
                .from('ocr_jobs')
                .insert({
                    id: jobId,
                    agent_id: profile.id,
                    franchise_id: profile.franchise_id,
                    status: 'processing',
                    file_name: `e2e-ocr-callback-${jobId}.pdf`,
                    file_path: null,
                    attempts: 1,
                    client_segment: 'PYME',
                });

            if (insertError) throw insertError;

            const response = await request.post('/api/webhooks/ocr/callback', {
                headers: { 'x-api-key': env.webhookApiKey },
                data: {
                    job_id: jobId,
                    status: 'completed',
                    data: {
                        client_name: `Cliente E2E OCR ${jobId.slice(0, 8)}`,
                        dni_cif: 'B12345678',
                        company_name: 'ENDESA Energia',
                        cups: `ES${jobId.replace(/-/g, '').slice(0, 18).toUpperCase()}`,
                        tariff_name: '3.0TD',
                        invoice_number: `E2E-${jobId.slice(0, 8)}`,
                        invoice_date: '2026-07-01',
                        period_days: 30,
                        supply_address: 'Calle E2E OCR 1, Madrid',
                        importe_total: 363,
                        power_p1: 15,
                        power_p2: 15,
                        power_p3: 15,
                        energy_p1: 1000,
                        energy_p2: 800,
                        energy_p3: 600,
                    },
                    confidence: {
                        client_name: 0.99,
                        cups: 0.99,
                    },
                    text_sample: 'Factura sintetica E2E sin datos reales.',
                },
            });

            expect(response.ok()).toBe(true);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.client_id).toBeTruthy();
            clientId = body.client_id as string;

            const { data: job, error: jobError } = await supabase
                .from('ocr_jobs')
                .select('id, status, client_id, extracted_data, client_segment')
                .eq('id', jobId)
                .single();
            if (jobError) throw jobError;

            expect(job.status).toBe('completed');
            expect(job.client_id).toBe(clientId);
            expect(job.client_segment).toBe('PYME');
            expect(job.extracted_data).toMatchObject({
                client_name: expect.stringContaining('Cliente E2E OCR'),
                company_name: expect.stringContaining('ENDESA'),
                tariff_name: '3.0TD',
            });

            const { data: client, error: clientError } = await supabase
                .from('clients')
                .select('id, owner_id, franchise_id, name, current_supplier, tariff_type, segment, type, cups_hash, dni_cif_hash')
                .eq('id', clientId)
                .single();
            if (clientError) throw clientError;

            expect(client).toMatchObject({
                id: clientId,
                owner_id: profile.id,
                franchise_id: profile.franchise_id,
                current_supplier: 'ENDESA Energia',
                tariff_type: '3.0TD',
                segment: 'PYME',
                type: 'company',
            });
            expect(client.name).toContain('Cliente E2E OCR');
            expect(client.cups_hash).toBeTruthy();
            expect(client.dni_cif_hash).toBeTruthy();
        } finally {
            await cleanupFixture(supabase, jobId, clientId);
        }
    });
});

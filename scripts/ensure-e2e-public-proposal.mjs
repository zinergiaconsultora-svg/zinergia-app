#!/usr/bin/env node
/**
 * Creates/refreshes deterministic public proposal fixtures in staging.
 *
 * This script is intentionally guarded. It refuses to run unless:
 * - .env.staging.local exists
 * - E2E_ALLOW_STAGING_SEED=1 is set
 * - NEXT_PUBLIC_SUPABASE_URL points to the known staging project
 *
 * Output tokens are stable and safe to copy into .env.staging.local.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const ENV_FILE = '.env.staging.local';
const STAGING_PROJECT_REF = 'dnzytocmtmnptndeczny';
const READONLY_TOKEN = 'e2e-readonly-public-proposal-token-20260630';
const ACCEPTANCE_TOKEN = 'e2e-acceptance-public-proposal-token-20260630';
const shouldWriteEnv = process.argv.includes('--write-env');

if (!existsSync(ENV_FILE)) {
    console.error(`[e2e-seed] Missing ${ENV_FILE}. See e2e/README.md.`);
    process.exit(1);
}

config({ path: ENV_FILE });

if (process.env.E2E_ALLOW_STAGING_SEED !== '1') {
    console.error('[e2e-seed] Refusing to seed without E2E_ALLOW_STAGING_SEED=1.');
    process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const agentEmail = process.env.E2E_AGENT_EMAIL;

if (!supabaseUrl || !serviceKey || !agentEmail) {
    console.error('[e2e-seed] Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or E2E_AGENT_EMAIL.');
    process.exit(1);
}

if (!supabaseUrl.includes(STAGING_PROJECT_REF)) {
    console.error(`[e2e-seed] Refusing to seed non-staging Supabase URL: ${supabaseUrl}`);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const now = new Date();
const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

const offerSnapshot = {
    type: 'fixed',
    marketer_name: 'Zinergia E2E',
    tariff_name: 'Fixture Publica',
    contract_duration: '12 meses',
    logo_color: '#4f46e5',
    estimated_agent_commission: 0,
};

const calculationData = {
    cups: 'E2E_PUBLIC_FIXTURE',
    client_name: 'Cliente E2E Publico',
    tariff_name: 'Fixture Publica',
};

async function getAgentProfile() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, franchise_id')
        .eq('email', agentEmail)
        .maybeSingle();

    if (error) throw new Error(`Profile lookup failed: ${error.message}`);
    if (!data) throw new Error(`No profile found for E2E_AGENT_EMAIL=${agentEmail}`);
    return data;
}

async function upsertClient(agentProfile) {
    const { data: existing, error: lookupError } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_id', agentProfile.id)
        .eq('lead_source', 'e2e-public-proposal-fixture')
        .maybeSingle();

    if (lookupError) throw new Error(`Client lookup failed: ${lookupError.message}`);
    if (existing?.id) return existing.id;

    const { data, error } = await supabase
        .from('clients')
        .insert({
            name: 'Cliente E2E Publico',
            owner_id: agentProfile.id,
            franchise_id: agentProfile.franchise_id,
            type: 'company',
            status: 'new',
            email: 'e2e-public-proposal@example.invalid',
            lead_source: 'e2e-public-proposal-fixture',
            notes: 'Fixture automatizado para Playwright. No usar como dato real.',
            average_monthly_bill: 100,
            current_supplier: 'Actual E2E',
            tariff_type: '2.0TD',
        })
        .select('id')
        .single();

    if (error) throw new Error(`Client insert failed: ${error.message}`);
    return data.id;
}

async function upsertProposal({ agentProfile, clientId, token, resetAcceptance }) {
    const { data: existing, error: lookupError } = await supabase
        .from('proposals')
        .select('id')
        .eq('public_token', token)
        .maybeSingle();

    if (lookupError) throw new Error(`Proposal lookup failed for ${token}: ${lookupError.message}`);

    const payload = {
        client_id: clientId,
        agent_id: agentProfile.id,
        franchise_id: agentProfile.franchise_id,
        status: 'sent',
        annual_savings: 420,
        savings_percent: 35,
        current_annual_cost: 1200,
        offer_annual_cost: 780,
        offer_snapshot: offerSnapshot,
        calculation_data: calculationData,
        public_token: token,
        public_expires_at: expiresAt,
        sent_date: now.toISOString(),
        notes: 'Fixture publica E2E. No representa una propuesta real.',
        optimization_result: {
            annual_optimization_savings: 72,
        },
        ...(resetAcceptance
            ? {
                public_accepted_at: null,
                signed_at: null,
                signed_name: null,
                signature_data: null,
            }
            : {}),
    };

    if (existing?.id) {
        const { error } = await supabase
            .from('proposals')
            .update(payload)
            .eq('id', existing.id);
        if (error) throw new Error(`Proposal update failed for ${token}: ${error.message}`);
        return existing.id;
    }

    const { data, error } = await supabase
        .from('proposals')
        .insert({ id: randomUUID(), ...payload })
        .select('id')
        .single();

    if (error) throw new Error(`Proposal insert failed for ${token}: ${error.message}`);
    return data.id;
}

function writeTokenEnv() {
    const envText = readFileSync(ENV_FILE, 'utf8');
    const updates = {
        E2E_PUBLIC_PROPOSAL_TOKEN: READONLY_TOKEN,
        E2E_MUTATING_PUBLIC_PROPOSAL_TOKEN: ACCEPTANCE_TOKEN,
    };

    let next = envText;
    for (const [key, value] of Object.entries(updates)) {
        const line = `${key}=${value}`;
        const pattern = new RegExp(`^${key}=.*$`, 'm');
        next = pattern.test(next)
            ? next.replace(pattern, line)
            : `${next.trimEnd()}\n${line}\n`;
    }

    if (next !== envText) {
        writeFileSync(ENV_FILE, next);
    }
}

try {
    const agentProfile = await getAgentProfile();
    const clientId = await upsertClient(agentProfile);
    const readonlyProposalId = await upsertProposal({
        agentProfile,
        clientId,
        token: READONLY_TOKEN,
        resetAcceptance: true,
    });
    const acceptanceProposalId = await upsertProposal({
        agentProfile,
        clientId,
        token: ACCEPTANCE_TOKEN,
        resetAcceptance: true,
    });

    console.log('[e2e-seed] Public proposal fixtures ready.');
    console.log(`E2E_PUBLIC_PROPOSAL_TOKEN=${READONLY_TOKEN}`);
    console.log(`E2E_MUTATING_PUBLIC_PROPOSAL_TOKEN=${ACCEPTANCE_TOKEN}`);
    console.log(`readonly_proposal_id=${readonlyProposalId}`);
    console.log(`acceptance_proposal_id=${acceptanceProposalId}`);
    if (shouldWriteEnv) {
        writeTokenEnv();
        console.log(`[e2e-seed] Updated ${ENV_FILE} with fixture token variables.`);
    }
} catch (error) {
    console.error(`[e2e-seed] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
}

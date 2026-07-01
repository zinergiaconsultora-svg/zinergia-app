/**
 * Staging-only mutating public proposal E2E.
 *
 * This intentionally accepts a fixture proposal, so it requires explicit opt-in:
 * E2E_RUN_MUTATING_PUBLIC_PROPOSAL=1.
 */

import { type Page } from '@playwright/test';
import { expect, test } from './fixtures/runtime';
import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STAGING_PROJECT_REF = 'dnzytocmtmnptndeczny';

test.use({ storageState: { cookies: [], origins: [] } });

function mutableEnv():
    | { supabaseUrl: string; serviceKey: string; token: string }
    | null {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const token = process.env.E2E_MUTATING_PUBLIC_PROPOSAL_TOKEN;

    if (process.env.E2E_RUN_MUTATING_PUBLIC_PROPOSAL !== '1') return null;
    if (!supabaseUrl || !serviceKey || !token) return null;
    if (!supabaseUrl.includes(STAGING_PROJECT_REF)) return null;

    return { supabaseUrl, serviceKey, token };
}

function serviceClient(env: { supabaseUrl: string; serviceKey: string }): SupabaseClient {
    return createClient(env.supabaseUrl, env.serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

function resetFixture(): void {
    execFileSync(process.execPath, ['scripts/ensure-e2e-public-proposal.mjs'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            E2E_ALLOW_STAGING_SEED: '1',
        },
        stdio: 'pipe',
    });
}

async function signProposal(page: Page) {
    await page.getByRole('button', { name: /aceptar y firmar/i }).click();
    await page.getByLabel(/nombre completo del firmante/i).fill('Cliente E2E Firma');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error('Signature canvas was not measurable');

    await page.mouse.move(box.x + 30, box.y + 75);
    await page.mouse.down();
    await page.mouse.move(box.x + 95, box.y + 45);
    await page.mouse.move(box.x + 165, box.y + 90);
    await page.mouse.move(box.x + 245, box.y + 50);
    await page.mouse.up();

    await expect(page.getByText(/firma registrada/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /confirmar firma/i })).toBeEnabled();
    await page.getByRole('button', { name: /confirmar firma/i }).click();
}

async function loadAcceptedFixtureState(supabase: SupabaseClient, token: string) {
    const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('id, status, public_accepted_at, signed_at, signed_name, signature_data')
        .eq('public_token', token)
        .maybeSingle();
    if (proposalError) throw proposalError;
    if (!proposal?.id) return null;

    const [{ data: commissions }, { data: tasks }, { data: contracts }] = await Promise.all([
        supabase.from('network_commissions').select('id, status').eq('proposal_id', proposal.id),
        supabase.from('tasks').select('id, title, type, auto_generated, status').eq('proposal_id', proposal.id),
        supabase.from('contracts').select('id, status').eq('proposal_id', proposal.id),
    ]);

    return {
        proposal,
        commissions: commissions ?? [],
        documentationTasks: (tasks ?? []).filter((task) => task.type === 'documentation'),
        contracts: contracts ?? [],
    };
}

test.describe('Public proposal — mutating staging acceptance', () => {
    test.setTimeout(60_000);

    test('signs a staging fixture and creates business side effects exactly once', async ({ page }) => {
        const env = mutableEnv();
        if (!env) {
            test.skip(true, 'Requires E2E_RUN_MUTATING_PUBLIC_PROPOSAL=1, staging Supabase URL, service key and E2E_MUTATING_PUBLIC_PROPOSAL_TOKEN.');
            return;
        }

        resetFixture();
        const supabase = serviceClient(env);

        await page.goto(`/p/${env.token}`);
        await expect(page.getByText(/de ahorro al año|ahorro estimado/i)).toBeVisible({ timeout: 10_000 });

        await signProposal(page);

        await expect(page.getByRole('heading', { name: /firmado/i })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(/tu propuesta ha sido aceptada|propuesta aceptada/i)).toBeVisible();

        await expect.poll(async () => loadAcceptedFixtureState(supabase, env.token), {
            timeout: 20_000,
            intervals: [500, 1_000, 2_000],
        }).toMatchObject({
            proposal: {
                status: 'accepted',
                signed_name: 'Cliente E2E Firma',
            },
            commissions: [{ status: 'pending' }],
            documentationTasks: [{
                title: 'Recopilar documentación',
                type: 'documentation',
                auto_generated: true,
                status: 'pending',
            }],
            contracts: [{ status: 'pending_switch' }],
        });

        const state = await loadAcceptedFixtureState(supabase, env.token);
        expect(state?.proposal.public_accepted_at).toBeTruthy();
        expect(state?.proposal.signed_at).toBeTruthy();
        expect(state?.proposal.signature_data).toMatch(/^data:image\/png;base64,/);
        expect(state?.commissions).toHaveLength(1);
        expect(state?.documentationTasks).toHaveLength(1);
        expect(state?.contracts).toHaveLength(1);
    });
});

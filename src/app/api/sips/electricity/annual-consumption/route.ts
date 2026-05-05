import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getElectricityAnnualConsumption, isValidCups, normalizeCups } from '@/lib/cnmc/sips';
import { hashCups } from '@/lib/crypto/pii';
import { rateLimit, getClientKey } from '@/lib/rate-limit';

const limiter = rateLimit({ windowMs: 60_000, max: 20 });
const CACHE_TTL_DAYS = 30;

const bodySchema = z.object({
    cups: z.string().min(20).max(24),
});

export async function POST(request: Request) {
    const rl = limiter.check(getClientKey(request));
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Too Many Requests' },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
        );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const cups = normalizeCups(parsed.data.cups);
    if (!isValidCups(cups)) {
        return NextResponse.json({ error: 'Invalid CUPS format' }, { status: 400 });
    }

    const cupsHash = hashCups(cups);
    const cached = await getCachedConsumption(supabase, cupsHash);
    if (cached) {
        await logSipsQuery(supabase, user.id, cupsHash, 'cache_hit', null);
        return NextResponse.json({
            annual_kwh: cached.annual_consumption_kwh,
            annual_mwh: cached.annual_consumption_mwh,
            rows: cached.rows_count,
            source: 'CNMC_SIPS_CACHE',
            cached: true,
            fetched_at: cached.fetched_at,
        });
    }

    try {
        const result = await getElectricityAnnualConsumption(cups);
        await upsertCachedConsumption(supabase, {
            cupsHash,
            annualKwh: result.annualKwh,
            annualMwh: result.annualMwh,
            rows: result.rows,
        });
        await logSipsQuery(supabase, user.id, cupsHash, 'success', null);
        return NextResponse.json({
            annual_kwh: result.annualKwh,
            annual_mwh: result.annualMwh,
            rows: result.rows,
            source: result.source,
            cached: false,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'CNMC SIPS request failed';
        const status = message.includes('Missing CNMC OAuth') ? 503 : 502;
        await logSipsQuery(supabase, user.id, cupsHash, 'error', message);
        return NextResponse.json({ error: message }, { status });
    }
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface CachedConsumptionRow {
    annual_consumption_kwh: number;
    annual_consumption_mwh: number;
    rows_count: number;
    fetched_at: string;
}

async function getCachedConsumption(supabase: SupabaseServerClient, cupsHash: string): Promise<CachedConsumptionRow | null> {
    const validAfter = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabase
        .from('sips_consumption_cache')
        .select('annual_consumption_kwh, annual_consumption_mwh, rows_count, fetched_at')
        .eq('cups_hash', cupsHash)
        .gte('fetched_at', validAfter)
        .maybeSingle();

    if (error) return null;
    return data as CachedConsumptionRow | null;
}

async function upsertCachedConsumption(
    supabase: SupabaseServerClient,
    row: { cupsHash: string; annualKwh: number; annualMwh: number; rows: number },
) {
    await supabase
        .from('sips_consumption_cache')
        .upsert({
            cups_hash: row.cupsHash,
            annual_consumption_kwh: row.annualKwh,
            annual_consumption_mwh: row.annualMwh,
            rows_count: row.rows,
            source: 'CNMC_SIPS',
            fetched_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + CACHE_TTL_DAYS * 86_400_000).toISOString(),
        }, { onConflict: 'cups_hash' });
}

async function logSipsQuery(
    supabase: SupabaseServerClient,
    userId: string,
    cupsHash: string,
    status: 'success' | 'cache_hit' | 'error',
    errorMessage: string | null,
) {
    await supabase
        .from('sips_query_audit')
        .insert({
            user_id: userId,
            cups_hash: cupsHash,
            status,
            error_message: errorMessage,
        });
}

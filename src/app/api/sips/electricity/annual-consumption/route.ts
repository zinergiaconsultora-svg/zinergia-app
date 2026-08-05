import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getElectricityAnnualConsumption, isValidCups, normalizeCups } from '@/lib/cnmc/sips';
import { hashCups } from '@/lib/crypto/pii';
import { rateLimit, getClientKey } from '@/lib/rate-limit';
import {
    authorizeSipsConsumption,
    type SipsAuthorizationReason,
} from '@/lib/sips/authorization';

const limiter = rateLimit({ windowMs: 60_000, max: 20 });

/**
 * Siete días, la ventana con la que trabaja el SIPS.
 *
 * Se usa solo al escribir. La lectura pregunta por `expires_at`, que es lo que
 * decide si una fila sirve: recalcular la ventana también al leer daba dos
 * fuentes para la misma decisión, y bastaba cambiar una para que la caché
 * empezara a servir datos que se creían caducados.
 */
const CACHE_TTL_DAYS = 7;

const bodySchema = z.object({
    cups: z.string().min(20).max(24),
});

/**
 * One stable message for every authorization denial. It must not let a caller distinguish
 * "this CUPS is unknown" from "this CUPS exists but is not yours" from "consent was
 * revoked" - otherwise the denial itself becomes an oracle over third-party supplies.
 */
const DENIED_MESSAGE = 'No autorizado para consultar este suministro. Puedes continuar con OCR o entrada manual.';

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

    // Authorization runs on the caller's own session, before any service client exists and
    // before any cache or CNMC access. A denial below reads no consumption data at all.
    const decision = await authorizeSipsConsumption(supabase, cupsHash);
    if (!decision.allowed) {
        await auditDenial(user.id, cupsHash, decision.reason);
        return NextResponse.json({ error: DENIED_MESSAGE }, { status: 403 });
    }

    const service = createServiceClient();
    const cached = await getCachedConsumption(service, cupsHash);
    if (cached) {
        await logSipsQuery(service, user.id, cupsHash, 'cache_hit', 'authorized');
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
        await upsertCachedConsumption(service, {
            cupsHash,
            annualKwh: result.annualKwh,
            annualMwh: result.annualMwh,
            rows: result.rows,
        });
        await logSipsQuery(service, user.id, cupsHash, 'success', 'authorized');
        return NextResponse.json({
            annual_kwh: result.annualKwh,
            annual_mwh: result.annualMwh,
            rows: result.rows,
            source: result.source,
            cached: false,
        });
    } catch (error) {
        // The upstream message is mapped to a stable code before it reaches the audit or the
        // client, so no third-party free text is persisted or echoed back.
        const message = error instanceof Error ? error.message : '';
        const isConfigurationGap = message.includes('Missing CNMC OAuth');
        await logSipsQuery(
            service,
            user.id,
            cupsHash,
            'error',
            isConfigurationGap ? 'upstream_unavailable' : 'upstream_failed',
        );
        return NextResponse.json(
            { error: 'El servicio SIPS no está disponible ahora mismo. Puedes continuar con OCR o entrada manual.' },
            { status: isConfigurationGap ? 503 : 502 },
        );
    }
}

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

interface CachedConsumptionRow {
    annual_consumption_kwh: number;
    annual_consumption_mwh: number;
    rows_count: number;
    fetched_at: string;
}

/**
 * Denials are audited too, otherwise the only observable trace of a probing attempt is its
 * absence. The service client is created here, after the decision, purely to satisfy the
 * insert-only audit policy - it never touches cache or CNMC on this path.
 */
async function auditDenial(userId: string, cupsHash: string, reason: SipsAuthorizationReason) {
    try {
        await logSipsQuery(createServiceClient(), userId, cupsHash, 'denied', reason);
    } catch {
        // An audit failure must not turn a denial into a success.
    }
}

async function getCachedConsumption(supabase: SupabaseServiceClient, cupsHash: string): Promise<CachedConsumptionRow | null> {
    // Se pregunta por `expires_at`, que es lo que la fila declara sobre sí misma.
    // Antes se restaban días a `fetched_at` aquí, de modo que la caducidad escrita
    // en la base de datos no llegaba a consultarse nunca.
    const { data, error } = await supabase
        .from('sips_consumption_cache')
        .select('annual_consumption_kwh, annual_consumption_mwh, rows_count, fetched_at')
        .eq('cups_hash', cupsHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (error) return null;
    return data as CachedConsumptionRow | null;
}

async function upsertCachedConsumption(
    supabase: SupabaseServiceClient,
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
    supabase: SupabaseServiceClient,
    userId: string,
    cupsHash: string,
    status: 'success' | 'cache_hit' | 'error' | 'denied',
    reasonCode: string,
) {
    await supabase
        .from('sips_query_audit')
        .insert({
            user_id: userId,
            cups_hash: cupsHash,
            status,
            reason_code: reasonCode,
        });
}

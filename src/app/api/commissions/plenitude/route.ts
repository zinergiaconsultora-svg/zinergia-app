import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { calculatePlenitudeCommission } from '@/lib/commissions/plenitude';
import { resolveAnnualConsumption } from '@/lib/consumption/annual';
import { rateLimit, getClientKey } from '@/lib/rate-limit';

const limiter = rateLimit({ windowMs: 60_000, max: 60 });

const bodySchema = z.object({
    tariff_type: z.string().min(1),
    product: z.string().optional().nullable(),
    tariff_name: z.string().min(1),
    annual_mwh: z.number().positive().optional(),
    annual_kwh: z.number().positive().optional(),
    cups: z.string().optional().nullable(),
    allow_sips: z.boolean().optional().default(false),
    invoice: z.record(z.string(), z.unknown()).optional().nullable(),
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

    const body = parsed.data;
    const consumption = await resolveAnnualConsumption({
        cups: body.cups,
        allowSips: body.allow_sips,
        manualAnnualKwh: body.annual_kwh ?? (body.annual_mwh ? body.annual_mwh * 1000 : null),
        invoice: body.invoice ?? null,
    });

    const band = calculatePlenitudeCommission(
        body.tariff_type,
        body.product,
        body.tariff_name,
        consumption.annualMwh,
    );

    if (!band) {
        return NextResponse.json({
            commission_eur: 0,
            band: null,
            consumption,
            warning: 'No matching Plenitude commission band for this tariff/product.',
        });
    }

    return NextResponse.json({
        commission_eur: band.commissionEur,
        band: {
            tariff_type: band.tariffType,
            group: band.group,
            min_mwh: band.minMwh,
            max_mwh: band.maxMwh,
        },
        consumption,
    });
}

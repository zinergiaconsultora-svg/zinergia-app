import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();
const createServiceClientMock = vi.fn();
const getElectricityAnnualConsumptionMock = vi.fn();
const hashCupsMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: createServiceClientMock,
}));

vi.mock('@/lib/cnmc/sips', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/cnmc/sips')>();
    return {
        ...actual,
        getElectricityAnnualConsumption: getElectricityAnnualConsumptionMock,
    };
});

vi.mock('@/lib/crypto/pii', () => ({
    hashCups: hashCupsMock,
}));

function selectCacheQuery(result: unknown) {
    const q = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        gt: vi.fn(() => q),
        maybeSingle: vi.fn(async () => result),
    };
    return q;
}

function upsertCacheQuery(result: unknown) {
    return {
        upsert: vi.fn(async () => result),
    };
}

function insertAuditQuery(result: unknown) {
    return {
        insert: vi.fn(async () => result),
    };
}

describe('SIPS annual consumption API', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-02T12:00:00.000Z'));
        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
            },
        });
        hashCupsMock.mockReturnValue('cups-hash-1');
    });

    it('returns a cached SIPS result while expires_at is still valid', async () => {
        const cacheQuery = selectCacheQuery({
            data: {
                annual_consumption_kwh: 24000,
                annual_consumption_mwh: 24,
                rows_count: 12,
                fetched_at: '2026-07-01T10:00:00.000Z',
            },
            error: null,
        });
        const auditQuery = insertAuditQuery({ error: null });
        const from = vi.fn((table: string) => {
            if (table === 'sips_consumption_cache') return cacheQuery;
            if (table === 'sips_query_audit') return auditQuery;
            throw new Error(`Unexpected table ${table}`);
        });
        createServiceClientMock.mockReturnValue({ from });

        const { POST } = await import('../route');
        const response = await POST(new Request('https://zinergia.test/api/sips/electricity/annual-consumption', {
            method: 'POST',
            body: JSON.stringify({ cups: 'ES0021000000000000AA1F' }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            annual_kwh: 24000,
            annual_mwh: 24,
            rows: 12,
            source: 'CNMC_SIPS_CACHE',
            cached: true,
        });
        expect(cacheQuery.gt).toHaveBeenCalledWith('expires_at', '2026-07-02T12:00:00.000Z');
        expect(getElectricityAnnualConsumptionMock).not.toHaveBeenCalled();
        expect(auditQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            user_id: 'user-1',
            cups_hash: 'cups-hash-1',
            status: 'cache_hit',
        }));
    });

    it('stores a 7-day cache expiry and sanitizes configuration errors for clients', async () => {
        const cacheMissQuery = selectCacheQuery({ data: null, error: null });
        const cacheUpsertQuery = upsertCacheQuery({ error: null });
        const auditQuery = insertAuditQuery({ error: null });
        let cacheCalls = 0;
        const from = vi.fn((table: string) => {
            if (table === 'sips_consumption_cache') {
                cacheCalls += 1;
                return cacheCalls === 1 ? cacheMissQuery : cacheUpsertQuery;
            }
            if (table === 'sips_query_audit') return auditQuery;
            throw new Error(`Unexpected table ${table}`);
        });
        createServiceClientMock.mockReturnValue({ from });
        getElectricityAnnualConsumptionMock.mockRejectedValue(
            new Error('Missing CNMC OAuth environment variables: CNMC_OAUTH_TOKEN_SECRET'),
        );

        const { POST } = await import('../route');
        const response = await POST(new Request('https://zinergia.test/api/sips/electricity/annual-consumption', {
            method: 'POST',
            body: JSON.stringify({ cups: 'ES0021000000000000AA1F' }),
        }));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.error).toBe('Servicio SIPS no configurado temporalmente');
        expect(JSON.stringify(body)).not.toContain('CNMC_OAUTH');
        expect(cacheUpsertQuery.upsert).not.toHaveBeenCalled();
        expect(auditQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            error_message: 'Missing CNMC OAuth environment variables: CNMC_OAUTH_TOKEN_SECRET',
        }));
    });

    it('stores fresh successful SIPS lookups with a 7-day expiry', async () => {
        const cacheMissQuery = selectCacheQuery({ data: null, error: null });
        const cacheUpsertQuery = upsertCacheQuery({ error: null });
        const auditQuery = insertAuditQuery({ error: null });
        let cacheCalls = 0;
        const from = vi.fn((table: string) => {
            if (table === 'sips_consumption_cache') {
                cacheCalls += 1;
                return cacheCalls === 1 ? cacheMissQuery : cacheUpsertQuery;
            }
            if (table === 'sips_query_audit') return auditQuery;
            throw new Error(`Unexpected table ${table}`);
        });
        createServiceClientMock.mockReturnValue({ from });
        getElectricityAnnualConsumptionMock.mockResolvedValue({
            cups: 'ES0021000000000000AA1F',
            annualKwh: 12000,
            annualMwh: 12,
            rows: 6,
            source: 'CNMC_SIPS',
        });

        const { POST } = await import('../route');
        const response = await POST(new Request('https://zinergia.test/api/sips/electricity/annual-consumption', {
            method: 'POST',
            body: JSON.stringify({ cups: 'ES0021000000000000AA1F' }),
        }));

        expect(response.status).toBe(200);
        expect(cacheUpsertQuery.upsert).toHaveBeenCalledWith(expect.objectContaining({
            fetched_at: '2026-07-02T12:00:00.000Z',
            expires_at: '2026-07-09T12:00:00.000Z',
        }), { onConflict: 'cups_hash' });
    });
});

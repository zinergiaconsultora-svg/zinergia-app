import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    createClientMock,
    createServiceClientMock,
    authorizeMock,
    getConsumptionMock,
    hashCupsMock,
} = vi.hoisted(() => ({
    createClientMock: vi.fn(),
    createServiceClientMock: vi.fn(),
    authorizeMock: vi.fn(),
    getConsumptionMock: vi.fn(),
    hashCupsMock: vi.fn(() => 'b'.repeat(64)),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: createServiceClientMock }));
vi.mock('@/lib/sips/authorization', () => ({
    authorizeSipsConsumption: authorizeMock,
    isLiveSipsAccessEnabled: () => true,
}));
vi.mock('@/lib/crypto/pii', () => ({ hashCups: hashCupsMock }));
vi.mock('@/lib/cnmc/sips', () => ({
    getElectricityAnnualConsumption: getConsumptionMock,
    isValidCups: () => true,
    normalizeCups: (value: string) => value.toUpperCase(),
}));

import { POST } from '../route';

const VALID_CUPS = 'ES0031102868105034EP';

function request(body: unknown = { cups: VALID_CUPS }) {
    return new Request('http://localhost/api/sips/electricity/annual-consumption', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.ceil(Math.random() * 250)}` },
        body: JSON.stringify(body),
    });
}

/** Service client that records every table touched, so we can assert what was never read. */
function serviceSpy() {
    const touched: string[] = [];
    const insert = vi.fn().mockResolvedValue({ error: null });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    // Which column the cache read filters on, and how. The freshness rule lives in
    // that filter, so the test has to be able to see it.
    const cacheFilters: Array<{ operador: string; columna: string; valor: string }> = [];

    const service = {
        from: vi.fn((table: string) => {
            touched.push(table);
            const registrar = (operador: string) => vi.fn((columna: string, valor: string) => {
                cacheFilters.push({ operador, columna, valor });
                return { maybeSingle };
            });
            return {
                insert,
                upsert,
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        gt: registrar('gt'),
                        gte: registrar('gte'),
                        maybeSingle,
                    })),
                })),
            };
        }),
    };
    return { service, touched, insert, upsert, maybeSingle, cacheFilters };
}

beforeEach(() => {
    createClientMock.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'actor-1' } } }) },
        rpc: vi.fn(),
    });
    authorizeMock.mockResolvedValue({ allowed: true, reason: 'authorized' });
    getConsumptionMock.mockResolvedValue({ annualKwh: 5000, annualMwh: 5, rows: 12, source: 'CNMC_SIPS' });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('POST /api/sips/electricity/annual-consumption', () => {
    it('rejects an unauthenticated request without authorizing or reading anything', async () => {
        createClientMock.mockResolvedValue({
            auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
            rpc: vi.fn(),
        });

        const response = await POST(request());

        expect(response.status).toBe(401);
        expect(authorizeMock).not.toHaveBeenCalled();
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    // This is the regression the whole slice exists to prevent.
    it('reads no cache and calls no CNMC when authorization is denied', async () => {
        const spy = serviceSpy();
        createServiceClientMock.mockReturnValue(spy.service);
        authorizeMock.mockResolvedValue({ allowed: false, reason: 'no_active_consent' });

        const response = await POST(request());

        expect(response.status).toBe(403);
        expect(getConsumptionMock).not.toHaveBeenCalled();
        expect(spy.touched).not.toContain('sips_consumption_cache');
        expect(spy.upsert).not.toHaveBeenCalled();
    });

    it('returns one generic denial message that does not reveal why', async () => {
        createServiceClientMock.mockReturnValue(serviceSpy().service);
        const reasons = ['no_active_consent', 'account_not_active', 'invalid_reference', 'access_disabled'];

        const bodies: string[] = [];
        for (const reason of reasons) {
            authorizeMock.mockResolvedValue({ allowed: false, reason });
            const response = await POST(request());
            expect(response.status).toBe(403);
            bodies.push(JSON.stringify(await response.json()));
        }

        expect(new Set(bodies).size).toBe(1);
        expect(bodies[0]).not.toMatch(/consent|consentimiento|cartera|portfolio/i);
    });

    it('audits a denial with its safe reason code and no raw CUPS', async () => {
        const spy = serviceSpy();
        createServiceClientMock.mockReturnValue(spy.service);
        authorizeMock.mockResolvedValue({ allowed: false, reason: 'no_active_consent' });

        await POST(request());

        expect(spy.touched).toContain('sips_query_audit');
        const audited = spy.insert.mock.calls[0][0];
        expect(audited).toMatchObject({ status: 'denied', reason_code: 'no_active_consent' });
        expect(JSON.stringify(audited)).not.toContain(VALID_CUPS);
    });

    it('authorizes with the caller session before creating the service client', async () => {
        const spy = serviceSpy();
        createServiceClientMock.mockReturnValue(spy.service);
        const order: string[] = [];
        authorizeMock.mockImplementation(async () => {
            order.push('authorize');
            return { allowed: true, reason: 'authorized' };
        });
        createServiceClientMock.mockImplementation(() => {
            order.push('service_client');
            return spy.service;
        });

        await POST(request());

        expect(order[0]).toBe('authorize');
    });

    it('serves an authorized request and records a safe reason code', async () => {
        const spy = serviceSpy();
        createServiceClientMock.mockReturnValue(spy.service);

        const response = await POST(request());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ annual_kwh: 5000, cached: false });
        expect(spy.insert).toHaveBeenCalledWith(expect.objectContaining({
            status: 'success',
            reason_code: 'authorized',
        }));
    });

    // La caché guarda el consumo anual de un suministro. Servir uno viejo hace que
    // una propuesta se calcule sobre datos que ya no valen, sin que nada lo indique.
    it('decides the cache freshness by expires_at, not by recomputing from fetched_at', async () => {
        const spy = serviceSpy();
        createServiceClientMock.mockReturnValue(spy.service);

        await POST(request());

        const filtro = spy.cacheFilters.at(0);
        expect(filtro?.columna).toBe('expires_at');
        expect(filtro?.operador).toBe('gt');
        expect(spy.cacheFilters.some(f => f.columna === 'fetched_at')).toBe(false);
    });

    it('compares expires_at against the present moment', async () => {
        const spy = serviceSpy();
        createServiceClientMock.mockReturnValue(spy.service);
        const antes = Date.now();

        await POST(request());

        const instante = Date.parse(spy.cacheFilters[0].valor);
        expect(instante).toBeGreaterThanOrEqual(antes - 1000);
        expect(instante).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('writes a cache entry that expires seven days after it was fetched', async () => {
        const spy = serviceSpy();
        createServiceClientMock.mockReturnValue(spy.service);

        await POST(request());

        const guardado = spy.upsert.mock.calls.at(-1)?.[0];
        const vencimiento = Date.parse(guardado.expires_at) - Date.parse(guardado.fetched_at);
        expect(Math.round(vencimiento / 86_400_000)).toBe(7);
    });

    it('maps an upstream failure to a stable code without persisting the raw message', async () => {
        const spy = serviceSpy();
        createServiceClientMock.mockReturnValue(spy.service);
        getConsumptionMock.mockRejectedValue(new Error('CNMC said: token 0xdeadbeef rejected for ES003110'));

        const response = await POST(request());

        expect(response.status).toBe(502);
        const audited = spy.insert.mock.calls.at(-1)?.[0];
        expect(audited).toMatchObject({ status: 'error', reason_code: 'upstream_failed' });
        expect(JSON.stringify(audited)).not.toContain('0xdeadbeef');
        await expect(response.json()).resolves.not.toMatchObject({ error: expect.stringContaining('0xdeadbeef') });
    });

    it('maps a missing CNMC credential to 503 without leaking configuration detail', async () => {
        const spy = serviceSpy();
        createServiceClientMock.mockReturnValue(spy.service);
        getConsumptionMock.mockRejectedValue(new Error('Missing CNMC OAuth consumer key'));

        const response = await POST(request());

        expect(response.status).toBe(503);
        expect(spy.insert).toHaveBeenCalledWith(expect.objectContaining({
            reason_code: 'upstream_unavailable',
        }));
    });
});

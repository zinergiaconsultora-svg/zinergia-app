import { beforeEach, describe, expect, it, vi } from 'vitest';

const createServiceClientMock = vi.fn();

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: createServiceClientMock }));
vi.mock('@/lib/push/sendPush', () => ({ sendPushToUser: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/logger', () => ({
    moduleLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('legacy permanence reminder endpoint', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'cron-secret';
    });

    it('delegates to the canonical idempotent renewal workflow', async () => {
        const rpc = vi.fn(async () => ({ data: [], error: null }));
        createServiceClientMock.mockReturnValue({ rpc });
        const { GET } = await import('../route');

        const response = await GET(new Request('https://zinergia.test/api/cron/permanence-reminders', {
            headers: { authorization: 'Bearer cron-secret' },
        }));

        expect(response.status).toBe(200);
        expect(rpc).toHaveBeenCalledWith('reconcile_contract_renewals', {
            p_as_of: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        });
    });
});

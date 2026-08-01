import { beforeEach, describe, expect, it, vi } from 'vitest';

const createServiceClientMock = vi.fn();
const sendPushToUserMock = vi.fn();

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: createServiceClientMock }));
vi.mock('@/lib/push/sendPush', () => ({ sendPushToUser: sendPushToUserMock }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/logger', () => ({
    moduleLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('canonical renewal cron', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-31T10:00:00.000Z'));
        process.env.CRON_SECRET = 'cron-secret';
        sendPushToUserMock.mockResolvedValue(undefined);
    });

    it('rejects requests before opening a service client', async () => {
        const { GET } = await import('../route');
        const response = await GET(new Request('https://zinergia.test/api/cron/detect-renewals'));

        expect(response.status).toBe(401);
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('reports only newly created opportunities and reminders', async () => {
        const rpc = vi.fn(async () => ({
            data: [
                {
                    contract_id: 'contract-1',
                    opportunity_id: 'opportunity-1',
                    owner_id: 'owner-1',
                    threshold_days: 60,
                    opportunity_created: true,
                    reminder_created: true,
                },
                {
                    contract_id: 'contract-2',
                    opportunity_id: 'opportunity-2',
                    owner_id: 'owner-2',
                    threshold_days: 30,
                    opportunity_created: false,
                    reminder_created: false,
                },
            ],
            error: null,
        }));
        createServiceClientMock.mockReturnValue({ rpc });
        const { GET } = await import('../route');

        const response = await GET(new Request('https://zinergia.test/api/cron/detect-renewals', {
            headers: { authorization: 'Bearer cron-secret' },
        }));

        expect(await response.json()).toEqual({
            eligibleContracts: 2,
            opportunitiesCreated: 1,
            remindersCreated: 1,
            pushesSent: 1,
        });
        expect(rpc).toHaveBeenCalledWith('reconcile_contract_renewals', { p_as_of: '2026-07-31' });
        expect(sendPushToUserMock).toHaveBeenCalledTimes(1);
        expect(sendPushToUserMock).toHaveBeenCalledWith('owner-1', expect.objectContaining({
            url: '/dashboard/opportunities/opportunity-1',
        }));
    });
});

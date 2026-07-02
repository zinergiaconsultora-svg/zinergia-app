import { beforeEach, describe, expect, it, vi } from 'vitest';

const createServiceClientMock = vi.fn();
const sendPushToUserMock = vi.fn();
const writeLeadAuditEventMock = vi.fn();
const captureExceptionMock = vi.fn();

vi.mock('@sentry/nextjs', () => ({
    captureException: captureExceptionMock,
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: createServiceClientMock,
}));

vi.mock('@/lib/push/sendPush', () => ({
    sendPushToUser: sendPushToUserMock,
}));

vi.mock('@/lib/audit/leadAuditLog', () => ({
    writeLeadAuditEvent: writeLeadAuditEventMock,
}));

vi.mock('@/lib/logger', () => ({
    moduleLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

function selectJobsQuery(result: unknown) {
    const q = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        is: vi.fn(() => q),
        not: vi.fn(() => q),
        lte: vi.fn(async () => result),
    };
    return q;
}

function selectAdminsQuery(result: unknown) {
    const q = {
        select: vi.fn(() => q),
        eq: vi.fn(async () => result),
    };
    return q;
}

function insertQuery(result: unknown) {
    return {
        insert: vi.fn(async () => result),
    };
}

function updateJobQuery(result: unknown) {
    const q = {
        update: vi.fn(() => q),
        eq: vi.fn(async () => result),
    };
    return q;
}

describe('permanence reminder cron', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-24T10:00:00.000Z'));
        process.env.CRON_SECRET = 'cron-secret';
        sendPushToUserMock.mockResolvedValue(undefined);
        writeLeadAuditEventMock.mockResolvedValue({ success: true });
    });

    it('detects renewals due in 60 days and writes a renewal audit event', async () => {
        const jobsQuery = selectJobsQuery({
            data: [{
                id: 'job-1',
                agent_id: 'agent-1',
                closed_company: 'Endesa',
                permanence_until: '2026-08-15',
                extracted_data: { client_name: 'Cliente Solar' },
            }],
            error: null,
        });
        const adminsQuery = selectAdminsQuery({
            data: [{ id: 'admin-1' }],
            error: null,
        });
        const notificationsQuery = insertQuery({ error: null });
        const updateQuery = updateJobQuery({ error: null });

        const from = vi.fn((table: string) => {
            if (table === 'ocr_jobs') {
                return from.mock.calls.filter(([name]) => name === 'ocr_jobs').length === 1
                    ? jobsQuery
                    : updateQuery;
            }
            if (table === 'profiles') return adminsQuery;
            if (table === 'notifications') return notificationsQuery;
            throw new Error(`Unexpected table ${table}`);
        });
        createServiceClientMock.mockReturnValue({ from });

        const { GET } = await import('../route');

        const response = await GET(new Request('https://zinergia.test/api/cron/permanence-reminders', {
            headers: { authorization: 'Bearer cron-secret' },
        }));
        const body = await response.json();

        expect(body).toMatchObject({ success: true, reminded: 1, notificationsSent: 2 });
        expect(jobsQuery.lte).toHaveBeenCalledWith('permanence_until', '2026-08-23');
        expect(writeLeadAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            jobId: 'job-1',
            actorId: null,
            eventType: 'renewal_alert',
            title: 'Alerta de renovación enviada',
            metadata: expect.objectContaining({
                permanenceUntil: '2026-08-15',
                reminderWindowDays: 60,
            }),
        }));
        expect(updateQuery.update).toHaveBeenCalledWith({
            permanence_reminded_at: expect.any(String),
        });
    });
});

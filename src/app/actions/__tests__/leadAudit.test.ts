import { beforeEach, describe, expect, it, vi } from 'vitest';

// Session client (auth + RLS-scoped reads)
const sessionSelectMock = vi.fn();
const sessionEqMock = vi.fn();
const orderMock = vi.fn();
const maybeSingleMock = vi.fn();
const sessionFromMock = vi.fn();
const getUserMock = vi.fn();

// Service client (the only writer)
const serviceInsertMock = vi.fn();
const serviceFromMock = vi.fn();

const requireServerRoleMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/lib/auth/permissions', () => ({ requireServerRole: requireServerRoleMock }));

const mockSessionClient = {
    auth: { getUser: getUserMock },
    from: sessionFromMock,
};

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => mockSessionClient),
    createUntypedClient: vi.fn(async () => mockSessionClient),
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: vi.fn(() => ({ from: serviceFromMock })),
}));

vi.mock('@/lib/utils/logger', () => ({ logger: { error: vi.fn() } }));

describe('lead audit actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        getUserMock.mockResolvedValue({ data: { user: { id: 'actor-1' } } });

        // authorizeActor: select('id').eq('id', jobId).maybeSingle() → job visible
        maybeSingleMock.mockResolvedValue({ data: { id: 'job-1' } });
        // getLeadAuditEventsAction: select(...).eq('job_id', x).order(...)
        orderMock.mockResolvedValue({ data: [], error: null });
        sessionEqMock.mockReturnValue({ maybeSingle: maybeSingleMock, order: orderMock });
        sessionSelectMock.mockReturnValue({ eq: sessionEqMock });
        sessionFromMock.mockReturnValue({ select: sessionSelectMock });

        // Service writer
        serviceInsertMock.mockResolvedValue({ error: null });
        serviceFromMock.mockReturnValue({ insert: serviceInsertMock });
    });

    it('rejects empty lead notes before authorizing or writing', async () => {
        const { addLeadNoteAction } = await import('../leadAudit');

        const result = await addLeadNoteAction('11111111-1111-4111-8111-111111111111', '   ');

        expect(result).toEqual({ success: false, message: 'La nota no puede estar vacía' });
        expect(serviceInsertMock).not.toHaveBeenCalled();
    });

    it('rejects a note when the lead is not accessible to the user', async () => {
        maybeSingleMock.mockResolvedValueOnce({ data: null });
        const { addLeadNoteAction } = await import('../leadAudit');

        const result = await addLeadNoteAction('11111111-1111-4111-8111-111111111111', 'Llamar mañana');

        expect(result).toEqual({ success: false, message: 'Lead no accesible' });
        expect(serviceInsertMock).not.toHaveBeenCalled();
    });

    it('writes a note event with the authenticated actor via the service client', async () => {
        const { addLeadNoteAction } = await import('../leadAudit');

        const result = await addLeadNoteAction('11111111-1111-4111-8111-111111111111', ' Llamar mañana ');

        expect(result).toEqual({ success: true });
        expect(serviceFromMock).toHaveBeenCalledWith('lead_audit_events');
        expect(serviceInsertMock).toHaveBeenCalledWith({
            job_id: '11111111-1111-4111-8111-111111111111',
            actor_id: 'actor-1',
            event_type: 'note_added',
            title: 'Nota interna',
            detail: 'Llamar mañana',
            metadata: {},
        });
    });

    it('loads audit events newest first', async () => {
        const { getLeadAuditEventsAction } = await import('../leadAudit');

        await getLeadAuditEventsAction('22222222-2222-4222-8222-222222222222');

        expect(sessionSelectMock).toHaveBeenCalled();
        expect(sessionEqMock).toHaveBeenCalledWith('job_id', '22222222-2222-4222-8222-222222222222');
        expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMock = vi.fn();
const eqMock = vi.fn();
const notMock = vi.fn();
const lteMock = vi.fn();
const orderMock = vi.fn();
const rangeMock = vi.fn();
const selectMock = vi.fn();
const stateSelectMock = vi.fn();
const stateEqMock = vi.fn();
const maybeSingleMock = vi.fn();
const fromMock = vi.fn();
const revalidatePathMock = vi.fn();
const requireServerRoleMock = vi.fn();
const recordLeadAuditEventMock = vi.fn();

vi.mock('next/cache', () => ({
    revalidatePath: revalidatePathMock,
}));

vi.mock('@/lib/auth/permissions', () => ({
    requireServerRole: requireServerRoleMock,
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        from: fromMock,
    })),
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: vi.fn(),
}));

vi.mock('../leadAudit', () => ({
    recordLeadAuditEvent: recordLeadAuditEventMock,
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}));

describe('invoice lead state actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        recordLeadAuditEventMock.mockResolvedValue({ success: true });
        maybeSingleMock.mockResolvedValue({
            data: { closed: false, lost: false, lost_reason: null },
            error: null,
        });
        stateEqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
        stateSelectMock.mockReturnValue({ eq: stateEqMock });
        eqMock.mockResolvedValue({ error: null });
        updateMock.mockReturnValue({ eq: eqMock });
        fromMock.mockReturnValue({ select: stateSelectMock, update: updateMock });
    });

    it('clears stale permanence reminders when a lead is closed as won', async () => {
        const { closeInvoiceAction } = await import('../invoices');

        const result = await closeInvoiceAction('11111111-1111-4111-8111-111111111111', {
            company: 'Nueva Energia',
            tariff: 'Plan fijo',
            permanenceUntil: '2027-06-01',
            commission: 125,
        });

        expect(result).toEqual({ success: true });
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            closed: true,
            lost: false,
            lost_at: null,
            lost_reason: null,
            permanence_reminded_at: null,
        }));
        expect(recordLeadAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            jobId: '11111111-1111-4111-8111-111111111111',
            eventType: 'lead_closed_won',
            title: 'Lead convertido en cliente',
        }));
    });

    it('records a closure update event when an already won lead is edited', async () => {
        maybeSingleMock.mockResolvedValueOnce({
            data: { closed: true, lost: false, lost_reason: null },
            error: null,
        });
        const { closeInvoiceAction } = await import('../invoices');

        const result = await closeInvoiceAction('11111111-1111-4111-8111-111111111111', {
            company: 'Nueva Energia',
            tariff: 'Plan fijo',
            permanenceUntil: '2027-06-01',
            commission: 125,
        });

        expect(result).toEqual({ success: true });
        expect(recordLeadAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'closure_updated',
            title: 'Cierre actualizado',
        }));
    });

    it('clears closure and reminder fields when a lead is marked lost', async () => {
        const { markLeadLostAction } = await import('../invoices');

        const result = await markLeadLostAction('22222222-2222-4222-8222-222222222222', 'Precio alto');

        expect(result).toEqual({ success: true });
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            lost: true,
            closed: false,
            closed_company: null,
            closed_tariff: null,
            permanence_until: null,
            commission_amount: null,
            closed_at: null,
            permanence_reminded_at: null,
        }));
        expect(recordLeadAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            jobId: '22222222-2222-4222-8222-222222222222',
            eventType: 'lead_marked_lost',
            title: 'Lead marcado como perdido',
            detail: 'Precio alto',
        }));
    });

    it('records a lost reason update event when an already lost lead is edited', async () => {
        maybeSingleMock.mockResolvedValueOnce({
            data: { closed: false, lost: true, lost_reason: 'No contesta' },
            error: null,
        });
        const { markLeadLostAction } = await import('../invoices');

        const result = await markLeadLostAction('22222222-2222-4222-8222-222222222222', 'Precio alto');

        expect(result).toEqual({ success: true });
        expect(recordLeadAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'lost_reason_updated',
            title: 'Motivo de pérdida actualizado',
            detail: 'Precio alto',
            metadata: { previousReason: 'No contesta', reason: 'Precio alto' },
        }));
    });

    it('clears permanence reminders when a lead is reopened', async () => {
        const { reopenInvoiceAction } = await import('../invoices');

        const result = await reopenInvoiceAction('33333333-3333-4333-8333-333333333333');

        expect(result).toEqual({ success: true });
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            closed: false,
            lost: false,
            closed_company: null,
            lost_reason: null,
            permanence_reminded_at: null,
        }));
        expect(recordLeadAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            jobId: '33333333-3333-4333-8333-333333333333',
            eventType: 'lead_reopened',
            title: 'Lead reabierto',
        }));
    });
});

describe('getAdminLeadsAction operational queues', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        recordLeadAuditEventMock.mockResolvedValue({ success: true });

        const query = {
            select: selectMock,
            eq: eqMock,
            not: notMock,
            lte: lteMock,
            order: orderMock,
            range: rangeMock,
        };

        selectMock.mockReturnValue(query);
        eqMock.mockReturnValue(query);
        notMock.mockReturnValue(query);
        lteMock.mockReturnValue(query);
        orderMock.mockReturnValue(query);
        rangeMock.mockResolvedValue({ data: [], error: null });
        fromMock.mockReturnValue(query);
    });

    it('filters the Drive pending operational queue', async () => {
        const { getAdminLeadsAction } = await import('../invoices');

        await getAdminLeadsAction({ queue: 'drive_pending' }, 30, 0);

        expect(eqMock).toHaveBeenCalledWith('archived_in_drive', false);
        expect(notMock).not.toHaveBeenCalledWith('process_status', 'in', '("closed_won","closed_lost")');
    });

    it('filters the OCR failed operational queue', async () => {
        const { getAdminLeadsAction } = await import('../invoices');

        await getAdminLeadsAction({ queue: 'ocr_failed' }, 30, 0);

        expect(eqMock).toHaveBeenCalledWith('process_status', 'failed');
    });

    it('filters permanence reviews due in the next 30 days', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-24T10:00:00.000Z'));
        const { getAdminLeadsAction } = await import('../invoices');

        await getAdminLeadsAction({ queue: 'permanence_due' }, 30, 0);

        expect(eqMock).toHaveBeenCalledWith('process_status', 'closed_won');
        expect(notMock).toHaveBeenCalledWith('permanencia_hasta', 'is', null);
        expect(lteMock).toHaveBeenCalledWith('permanencia_hasta', '2026-07-24');

        vi.useRealTimers();
    });
});

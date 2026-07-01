import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExpedienteAlta from '../ExpedienteAlta';
import type { AltaEvent, AltaExpediente } from '@/app/actions/alta';

const mocks = vi.hoisted(() => ({
    confirmConsent: vi.fn(),
    requestAlta: vi.fn(),
    completeAlta: vi.fn(),
    rejectAlta: vi.fn(),
    reopenAlta: vi.fn(),
    getAltaEvents: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock('@/app/actions/alta', () => ({
    confirmConsent: mocks.confirmConsent,
    requestAlta: mocks.requestAlta,
    completeAlta: mocks.completeAlta,
    rejectAlta: mocks.rejectAlta,
    reopenAlta: mocks.reopenAlta,
    getAltaEvents: mocks.getAltaEvents,
}));

vi.mock('sonner', () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
    },
}));

function expediente(overrides: Partial<AltaExpediente> = {}): AltaExpediente {
    return {
        id: 'proposal-1',
        clientId: 'client-1',
        clientName: 'Cliente Demo',
        clientEmail: 'cliente@example.com',
        clientNif: '12345678Z',
        clientIban: 'ES9121000418450200051332',
        agentId: 'agent-1',
        agentName: 'Comercial Demo',
        agentEmail: 'agent@example.com',
        altaStatus: 'pendiente_consent',
        consentConfirmedAt: null,
        sepaConfirmedAt: null,
        altaRequestedAt: null,
        altaCompletadaAt: null,
        altaRejectedAt: null,
        altaRejectionReason: null,
        altaRejectionNote: null,
        calculationData: {
            cups: 'ES0021000000000000AA1F',
            tariff_name: '2.0TD',
            contracted_power: '4.6 kW',
        },
        offerSnapshot: {
            marketer_name: 'Nueva Energia',
            tariff_name: '2.0TD',
        },
        currentAnnualCost: 1200,
        offerAnnualCost: 900,
        annualSavings: 300,
        createdAt: '2026-07-01T08:00:00.000Z',
        ...overrides,
    };
}

function altaEvent(overrides: Partial<AltaEvent> = {}): AltaEvent {
    return {
        id: 'event-1',
        eventType: 'alta_requested',
        detail: 'Alta solicitada',
        createdAt: '2026-07-01T09:00:00.000Z',
        ...overrides,
    };
}

describe('ExpedienteAlta', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('refreshes the visible history count after a successful alta action', async () => {
        mocks.getAltaEvents
            .mockResolvedValueOnce([altaEvent()])
            .mockResolvedValueOnce([
                altaEvent({
                    id: 'event-2',
                    eventType: 'consent_confirmed',
                    detail: 'Consentimiento confirmado',
                    createdAt: '2026-07-01T10:00:00.000Z',
                }),
                altaEvent(),
            ]);
        mocks.confirmConsent.mockResolvedValue({ ok: true });
        const onRefresh = vi.fn();

        render(<ExpedienteAlta expediente={expediente()} onRefresh={onRefresh} />);

        expect(await screen.findByRole('button', { name: /historial \(1\)/i })).toBeTruthy();

        fireEvent.click(screen.getByRole('checkbox', { name: /mandato sepa recibido/i }));
        fireEvent.click(screen.getByRole('button', { name: /confirmar consentimiento/i }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /historial \(2\)/i })).toBeTruthy();
        });
        expect(mocks.confirmConsent).toHaveBeenCalledWith('proposal-1', true);
        expect(mocks.getAltaEvents).toHaveBeenCalledTimes(2);
        expect(onRefresh).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: /historial \(2\)/i }));
        expect(screen.getByText('Consentimiento confirmado')).toBeTruthy();
    });

    it('keeps the parent refresh untouched when an alta action fails', async () => {
        mocks.getAltaEvents.mockResolvedValue([]);
        mocks.confirmConsent.mockResolvedValue({ ok: false, error: 'Estado no permitido' });
        const onRefresh = vi.fn();

        render(<ExpedienteAlta expediente={expediente()} onRefresh={onRefresh} />);

        fireEvent.click(screen.getByRole('button', { name: /confirmar consentimiento/i }));

        await waitFor(() => {
            expect(mocks.toastError).toHaveBeenCalledWith('Estado no permitido');
        });
        expect(onRefresh).not.toHaveBeenCalled();
        expect(mocks.getAltaEvents).toHaveBeenCalledTimes(1);
    });

    it('runs the request and completion gates with refreshed history', async () => {
        mocks.getAltaEvents
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([altaEvent({ eventType: 'alta_requested' })])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([altaEvent({ eventType: 'alta_completed' })]);
        mocks.requestAlta.mockResolvedValue({ ok: true });
        mocks.completeAlta.mockResolvedValue({ ok: true });
        const onRequestRefresh = vi.fn();

        const { unmount: unmountRequest } = render(
            <ExpedienteAlta
                expediente={expediente({
                    altaStatus: 'lista_admin',
                    clientNif: '123',
                    clientIban: 'ES00',
                    calculationData: { cups: 'INVALID', tariff_name: '2.0TD' },
                })}
                onRefresh={onRequestRefresh}
            />,
        );

        expect(screen.getByText(/revisa los campos marcados/i)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /marcar alta solicitada/i }));

        await waitFor(() => {
            expect(mocks.requestAlta).toHaveBeenCalledWith('proposal-1');
        });
        expect(onRequestRefresh).toHaveBeenCalledTimes(1);
        unmountRequest();

        const onCompleteRefresh = vi.fn();
        render(
            <ExpedienteAlta
                expediente={expediente({
                    id: 'proposal-2',
                    altaStatus: 'en_alta',
                    altaRequestedAt: '2026-06-25T08:00:00.000Z',
                })}
                onRefresh={onCompleteRefresh}
            />,
        );

        expect(screen.getByText(/SLA legal/i)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /confirmar activación/i }));

        await waitFor(() => {
            expect(mocks.completeAlta).toHaveBeenCalledWith('proposal-2');
        });
        expect(onCompleteRefresh).toHaveBeenCalledTimes(1);
    });

    it('submits rejection details and supports reopening a rejected expediente', async () => {
        mocks.getAltaEvents
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([altaEvent({ eventType: 'alta_reopened' })]);
        mocks.rejectAlta.mockResolvedValue({ ok: true });
        mocks.reopenAlta.mockResolvedValue({ ok: true });
        const onRejectRefresh = vi.fn();

        const { unmount: unmountReject } = render(<ExpedienteAlta expediente={expediente()} onRefresh={onRejectRefresh} />);

        fireEvent.click(screen.getByRole('button', { name: /rechazar alta/i }));
        expect(screen.getByRole('dialog', { name: /rechazar alta/i })).toBeTruthy();
        fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'deuda_pendiente' } });
        fireEvent.change(screen.getByLabelText(/nota \(opcional\)/i), { target: { value: 'Factura pendiente' } });
        fireEvent.click(screen.getByRole('button', { name: /confirmar rechazo/i }));

        await waitFor(() => {
            expect(mocks.rejectAlta).toHaveBeenCalledWith({
                proposalId: 'proposal-1',
                reason: 'deuda_pendiente',
                note: 'Factura pendiente',
            });
        });
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Alta marcada como rechazada');
        expect(onRejectRefresh).toHaveBeenCalledTimes(1);
        unmountReject();

        const onReopenRefresh = vi.fn();
        render(
            <ExpedienteAlta
                expediente={expediente({
                    id: 'proposal-3',
                    altaStatus: 'rechazada',
                    altaRejectionReason: 'deuda_pendiente',
                    altaRejectionNote: 'Factura pendiente',
                })}
                onRefresh={onReopenRefresh}
            />,
        );

        expect(screen.getByText(/Factura pendiente/i)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /reabrir y corregir/i }));

        await waitFor(() => {
            expect(mocks.reopenAlta).toHaveBeenCalledWith('proposal-3');
        });
        expect(onReopenRefresh).toHaveBeenCalledTimes(1);
    });

    it('keeps keyboard focus inside the rejection modal and closes it with Escape', async () => {
        mocks.getAltaEvents.mockResolvedValue([]);
        const onRefresh = vi.fn();
        render(<ExpedienteAlta expediente={expediente()} onRefresh={onRefresh} />);

        const rejectButton = screen.getByRole('button', { name: /rechazar alta/i });
        fireEvent.click(rejectButton);

        const dialog = screen.getByRole('dialog', { name: /rechazar alta/i });
        const reasonSelect = screen.getByLabelText(/motivo/i);
        const confirmButton = screen.getByRole('button', { name: /confirmar rechazo/i });

        await waitFor(() => {
            expect(document.activeElement).toBe(reasonSelect);
        });

        fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(confirmButton);

        fireEvent.keyDown(dialog, { key: 'Tab' });
        expect(document.activeElement).toBe(reasonSelect);

        fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: /rechazar alta/i })).toBeNull();
        expect(mocks.rejectAlta).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(rejectButton);
    });
});

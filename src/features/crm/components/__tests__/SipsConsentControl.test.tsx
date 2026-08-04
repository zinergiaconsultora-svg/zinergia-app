import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { getStatusMock, recordMock, revokeMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    getStatusMock: vi.fn(),
    recordMock: vi.fn(),
    revokeMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('@/app/actions/sipsConsent', () => ({
    getSipsConsentStatusAction: getStatusMock,
    recordSipsConsentAction: recordMock,
    revokeSipsConsentAction: revokeMock,
}));

vi.mock('sonner', () => ({
    toast: { success: toastSuccessMock, error: toastErrorMock },
}));

import SipsConsentControl from '../SipsConsentControl';

const CUPS = 'ES0031102868105034EP';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const CONSENT_ID = '22222222-2222-4222-8222-222222222222';

function renderControl() {
    return render(<SipsConsentControl cups={CUPS} clientId={CLIENT_ID} />);
}

beforeEach(() => {
    getStatusMock.mockResolvedValue({ sipsEnabled: true, hasActiveConsent: false });
    recordMock.mockResolvedValue({ success: true, data: { consentId: CONSENT_ID, created: true } });
    revokeMock.mockResolvedValue({ success: true, data: null });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('SipsConsentControl', () => {
    // With SIPS off there is nothing to consent to. Prompting anyway would be noise the
    // agent cannot resolve.
    it('renders nothing at all when SIPS is disabled', async () => {
        getStatusMock.mockResolvedValue({ sipsEnabled: false, hasActiveConsent: false });

        const { container } = renderControl();

        await waitFor(() => expect(getStatusMock).toHaveBeenCalled());
        await waitFor(() => expect(container.querySelector('[aria-hidden="true"]')).toBeNull());
        expect(container.textContent).toBe('');
    });

    it('warns when the supply has no consent yet', async () => {
        renderControl();

        expect(await screen.findByText(/Sin consentimiento/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Registrar' })).toBeTruthy();
    });

    it('keeps the capture form collapsed until the agent asks for it', async () => {
        renderControl();

        const toggle = await screen.findByRole('button', { name: 'Registrar' });
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByRole('button', { name: /Registrar consentimiento/i })).toBeNull();

        fireEvent.click(toggle);

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('button', { name: /Registrar consentimiento/i })).toBeTruthy();
    });

    it('records the consent with the chosen source and refreshes', async () => {
        renderControl();

        fireEvent.click(await screen.findByRole('button', { name: 'Registrar' }));
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'signed_document' } });
        fireEvent.click(screen.getByRole('button', { name: /Registrar consentimiento/i }));

        await waitFor(() => expect(recordMock).toHaveBeenCalledWith(expect.objectContaining({
            cups: CUPS,
            clientId: CLIENT_ID,
            source: 'signed_document',
        })));
        expect(toastSuccessMock).toHaveBeenCalledWith('Consentimiento registrado');
        // Once on mount, once after the mutation.
        await waitFor(() => expect(getStatusMock).toHaveBeenCalledTimes(2));
    });

    it('tells the agent when a consent was already active instead of claiming a new one', async () => {
        recordMock.mockResolvedValue({ success: true, data: { consentId: CONSENT_ID, created: false } });
        renderControl();

        fireEvent.click(await screen.findByRole('button', { name: 'Registrar' }));
        fireEvent.click(screen.getByRole('button', { name: /Registrar consentimiento/i }));

        await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith(
            'Ya había un consentimiento activo para este suministro',
        ));
    });

    it('surfaces a denied capture and leaves the form open', async () => {
        recordMock.mockResolvedValue({ success: false, error: 'No puedes registrar el consentimiento de este suministro.' });
        renderControl();

        fireEvent.click(await screen.findByRole('button', { name: 'Registrar' }));
        fireEvent.click(screen.getByRole('button', { name: /Registrar consentimiento/i }));

        await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
        expect(screen.getByRole('button', { name: /Registrar consentimiento/i })).toBeTruthy();
    });

    it('shows the authorised state with its date and source', async () => {
        getStatusMock.mockResolvedValue({
            sipsEnabled: true,
            hasActiveConsent: true,
            consentId: CONSENT_ID,
            consentAt: '2026-08-04T10:00:00.000Z',
            consentSource: 'verbal_visit',
            capturedByMe: true,
        });

        renderControl();

        expect(await screen.findByText(/Consulta SIPS autorizada/i)).toBeTruthy();
        expect(screen.getByText(/Verbal en visita/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Revocar' })).toBeTruthy();
    });

    it('revokes an active consent and says the query is now blocked', async () => {
        getStatusMock.mockResolvedValue({
            sipsEnabled: true,
            hasActiveConsent: true,
            consentId: CONSENT_ID,
            consentAt: '2026-08-04T10:00:00.000Z',
            consentSource: 'agent_confirmation',
        });

        renderControl();

        fireEvent.click(await screen.findByRole('button', { name: 'Revocar' }));

        await waitFor(() => expect(revokeMock).toHaveBeenCalledWith(CONSENT_ID));
        expect(toastSuccessMock).toHaveBeenCalledWith(
            'Consentimiento revocado. La consulta SIPS queda bloqueada.',
        );
    });

    // A failed lookup must not imply an authorization nobody confirmed.
    it('falls back to rendering nothing when the status lookup throws', async () => {
        getStatusMock.mockRejectedValue(new Error('network down'));

        const { container } = renderControl();

        await waitFor(() => expect(getStatusMock).toHaveBeenCalled());
        await waitFor(() => expect(container.textContent).toBe(''));
    });
});

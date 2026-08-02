import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    configureFiscalOrganizationAction,
    proposeSelfBillingAgreementAction,
    revokeSelfBillingAgreementAction,
} from '@/app/actions/invoicing';
import { FiscalAdministrationPanel } from '../FiscalAdministrationPanel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/app/actions/invoicing', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/app/actions/invoicing')>(),
    configureFiscalOrganizationAction: vi.fn(),
    proposeSelfBillingAgreementAction: vi.fn(),
    revokeSelfBillingAgreementAction: vi.fn(),
}));

const agreementId = '11111111-1111-4111-8111-111111111111';

describe('FiscalAdministrationPanel', () => {
    it('renders real entity fields and an explicit agreement revocation form', () => {
        render(<FiscalAdministrationPanel
            data={{
                organization: null,
                agreements: [{
                    id: agreementId,
                    commercialId: '22222222-2222-4222-8222-222222222222',
                    commercialName: 'Comercial Uno',
                    reference: 'AUTO-2026-001',
                    scope: 'Comisiones energéticas',
                    proposedAt: '2026-08-01T10:00:00Z',
                    acceptedAt: '2026-08-01T11:00:00Z',
                    revokedAt: null,
                    revocationReason: null,
                }],
            }}
            commercials={[{ id: '22222222-2222-4222-8222-222222222222', name: 'Comercial Uno', email: null, role: 'agent' }]}
        />);

        expect(screen.getByLabelText('Razón social')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Proponer acuerdo' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Revocar' }));
        expect(screen.getByRole('dialog', { name: 'Revocar acuerdo' })).toBeTruthy();
        const confirm = screen.getByRole('button', { name: 'Confirmar revocación' }) as HTMLButtonElement;
        expect(confirm.disabled).toBe(true);
        fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Fin del acuerdo' } });
        expect(confirm.disabled).toBe(false);
    });

    it('persists organization data and completes the agreement lifecycle', async () => {
        vi.mocked(configureFiscalOrganizationAction).mockResolvedValue({ success: true });
        vi.mocked(proposeSelfBillingAgreementAction).mockResolvedValue({ success: true });
        vi.mocked(revokeSelfBillingAgreementAction).mockResolvedValue({ success: true });

        render(<FiscalAdministrationPanel
            data={{
                organization: null,
                agreements: [{
                    id: agreementId,
                    commercialId: '22222222-2222-4222-8222-222222222222',
                    commercialName: 'Comercial Uno',
                    reference: 'AUTO-2026-001',
                    scope: 'Comisiones energéticas',
                    proposedAt: '2026-08-01T10:00:00Z',
                    acceptedAt: '2026-08-01T11:00:00Z',
                    revokedAt: null,
                    revocationReason: null,
                }],
            }}
            commercials={[{
                id: '22222222-2222-4222-8222-222222222222',
                name: 'Comercial Uno',
                email: null,
                role: 'agent',
            }]}
        />);

        fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'Zinergia Energía SL' } });
        fireEvent.change(screen.getByLabelText('NIF'), { target: { value: 'b12345678' } });
        fireEvent.change(screen.getByLabelText('Dirección fiscal'), { target: { value: 'Calle Mayor 1' } });
        fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Madrid' } });
        fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '28001' } });
        fireEvent.change(screen.getByLabelText('País'), { target: { value: 'Portugal' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar entidad' }));

        await waitFor(() => expect(configureFiscalOrganizationAction).toHaveBeenCalledWith({
            legalName: 'Zinergia Energía SL',
            nif: 'B12345678',
            fiscalAddress: 'Calle Mayor 1',
            fiscalCity: 'Madrid',
            fiscalPostalCode: '28001',
            fiscalCountry: 'Portugal',
        }));

        fireEvent.change(screen.getByLabelText('Comercial'), {
            target: { value: '22222222-2222-4222-8222-222222222222' },
        });
        fireEvent.change(screen.getByLabelText('Referencia del acuerdo'), { target: { value: 'AUTO-2026-002' } });
        fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: 'Comisiones verificadas' } });
        fireEvent.click(screen.getByRole('button', { name: 'Proponer acuerdo' }));

        await waitFor(() => expect(proposeSelfBillingAgreementAction).toHaveBeenCalledWith({
            commercialId: '22222222-2222-4222-8222-222222222222',
            reference: 'AUTO-2026-002',
            scope: 'Comisiones verificadas',
        }));

        fireEvent.click(screen.getByRole('button', { name: 'Revocar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Revocar' }));
        fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Fin pactado' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar revocación' }));

        await waitFor(() => expect(revokeSelfBillingAgreementAction).toHaveBeenCalledWith(
            agreementId,
            'Fin pactado',
        ));
    });
});

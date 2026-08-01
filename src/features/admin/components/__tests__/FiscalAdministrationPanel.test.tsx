import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
});

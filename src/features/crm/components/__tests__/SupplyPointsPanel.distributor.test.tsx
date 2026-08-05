import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { getPointsMock, createMock, deleteMock } = vi.hoisted(() => ({
    getPointsMock: vi.fn(),
    createMock: vi.fn(),
    deleteMock: vi.fn(),
}));

vi.mock('@/app/actions/energy', () => ({
    getSupplyPointsAction: getPointsMock,
    createSupplyPointAction: createMock,
    deleteSupplyPointAction: deleteMock,
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

// El control de consentimiento carga sus propios datos y tiene su test aparte.
vi.mock('../SipsConsentControl', () => ({
    default: () => null,
}));

import SupplyPointsPanel from '../SupplyPointsPanel';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

function point(overrides: Record<string, unknown>) {
    return {
        id: '33333333-3333-4333-8333-333333333333',
        client_id: CLIENT_ID,
        cups: 'ES0031102868105034EP',
        supply_type: 'electricity',
        address: null,
        current_marketer: null,
        is_primary: false,
        ...overrides,
    };
}

beforeEach(() => {
    getPointsMock.mockResolvedValue([]);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('SupplyPointsPanel — distribuidora', () => {
    it('muestra la distribuidora deducida del CUPS', async () => {
        getPointsMock.mockResolvedValue([point({ cups: 'ES0021000000000000AB' })]);

        render(<SupplyPointsPanel clientId={CLIENT_ID} />);

        expect(await screen.findByText('i-DE REDES ELÉCTRICAS INTELIGENTES, S.A.U')).toBeTruthy();
    });

    it('no inventa nada cuando el prefijo no consta en la tabla', async () => {
        getPointsMock.mockResolvedValue([point({ cups: 'ES9999000000000000AB' })]);

        render(<SupplyPointsPanel clientId={CLIENT_ID} />);

        // El CUPS se pinta; la distribuidora no, porque no se conoce.
        expect(await screen.findByText('ES9999000000000000AB')).toBeTruthy();
        expect(screen.queryByTitle('Distribuidora, deducida del CUPS')).toBeNull();
    });

    // La tabla de prefijos es de distribuidoras eléctricas: aplicarla a un CUPS de gas
    // daría un nombre que no corresponde.
    it('no muestra distribuidora en un punto de gas', async () => {
        getPointsMock.mockResolvedValue([point({ cups: 'ES0021000000000000AB', supply_type: 'gas' })]);

        render(<SupplyPointsPanel clientId={CLIENT_ID} />);

        await screen.findByText('ES0021000000000000AB');
        expect(screen.queryByText('i-DE REDES ELÉCTRICAS INTELIGENTES, S.A.U')).toBeNull();
    });

    it('convive con la dirección y la comercializadora en la misma línea', async () => {
        getPointsMock.mockResolvedValue([
            point({
                cups: 'ES0022000000000000AB',
                address: 'Calle Mayor 1',
                current_marketer: 'NATURGY',
            }),
        ]);

        render(<SupplyPointsPanel clientId={CLIENT_ID} />);

        await waitFor(() => {
            expect(screen.getByText('Calle Mayor 1')).toBeTruthy();
            expect(screen.getByText('NATURGY')).toBeTruthy();
            expect(screen.getByText('UFD DISTRIBUCIÓN ELECTRICIDAD, SA')).toBeTruthy();
        });
    });
});

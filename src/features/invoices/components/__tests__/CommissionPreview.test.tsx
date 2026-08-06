import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { getRatesMock } = vi.hoisted(() => ({ getRatesMock: vi.fn() }));

vi.mock('@/app/actions/collaboratorCommission', () => ({
    getCollaboratorRatesAction: getRatesMock,
}));

import { CommissionPreview } from '../CommissionPreview';

const AGENTE = '11111111-1111-4111-8111-111111111111';

function renderizar(props: Partial<React.ComponentProps<typeof CommissionPreview>> = {}) {
    const onExtraChange = vi.fn();
    render(
        <CommissionPreview
            agentId={AGENTE}
            grossCommission={120}
            extraAmount={0}
            onExtraChange={onExtraChange}
            {...props}
        />,
    );
    return { onExtraChange };
}

beforeEach(() => {
    getRatesMock.mockResolvedValue([{ rateBps: 6000, effectiveFrom: '2026-08-01T00:00:00Z', note: null }]);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('CommissionPreview', () => {
    // Sin extra, el importe del porcentaje y el total son el mismo número y
    // aparecen dos veces. Se espera por la línea del desglose, que es única.
    const esperarDesglose = () => screen.findByText(/60 % de/);

    it('desglosa el porcentaje sobre la comisión de la operación', async () => {
        renderizar();

        const desglose = await esperarDesglose();
        expect(desglose.textContent).toContain('120.00 €');
        expect(desglose.textContent).toContain('72.00 €');
    });

    it('suma el extra al total', async () => {
        renderizar({ extraAmount: 50 });

        await esperarDesglose();
        expect(screen.getByText('122.00 €')).toBeTruthy();
    });

    it('devuelve el extra escrito en euros', async () => {
        const { onExtraChange } = renderizar();
        await esperarDesglose();

        fireEvent.change(screen.getByLabelText(/Extra para esta operación/i), { target: { value: '35.5' } });

        expect(onExtraChange).toHaveBeenCalledWith(35.5);
    });

    // Un campo vaciado o con basura vale cero, no NaN: un NaN acabaría propagándose
    // al importe que se liquida. Se escribe algo primero, porque el campo ya nace
    // vacío y volver a vaciarlo no cambia nada.
    it('trata un extra vacío o imposible como cero', async () => {
        const { onExtraChange } = renderizar();
        await esperarDesglose();

        const campo = screen.getByLabelText(/Extra para esta operación/i);
        fireEvent.change(campo, { target: { value: '40' } });
        expect(onExtraChange).toHaveBeenLastCalledWith(40);

        fireEvent.change(campo, { target: { value: '' } });
        expect(onExtraChange).toHaveBeenLastCalledWith(0);
    });

    // Cobrar cero sin avisar es peor que no cobrar: nadie lo mira hasta que llega
    // la liquidación.
    it('avisa cuando el colaborador no tiene porcentaje configurado', async () => {
        getRatesMock.mockResolvedValue([]);
        renderizar();

        expect(await screen.findByText(/no tiene porcentaje configurado/i)).toBeTruthy();
    });

    it('sobrevive a un fallo de carga sin tumbar el formulario', async () => {
        getRatesMock.mockRejectedValue(new Error('sin conexión'));
        renderizar();

        expect(await screen.findByText(/no tiene porcentaje configurado/i)).toBeTruthy();
        expect(screen.getByLabelText(/Extra para esta operación/i)).toBeTruthy();
    });
});

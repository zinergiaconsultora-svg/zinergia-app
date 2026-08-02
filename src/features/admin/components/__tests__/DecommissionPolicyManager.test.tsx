import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecommissionPolicyManager } from '../DecommissionPolicyManager';

describe('DecommissionPolicyManager', () => {
    it('shows the canonical proportional permanence rule without editable bands', () => {
        render(<DecommissionPolicyManager policies={[]} />);

        expect(screen.getByText('Regla vigente · v1')).toBeTruthy();
        expect(screen.getByText('Cálculo proporcional por días')).toBeTruthy();
        expect(
            screen.getAllByText(
                (_, node) =>
                    node?.textContent ===
                    'Devolución = días pendientes ÷ días totales de permanencia',
            ).length,
        ).toBeGreaterThan(0);
        expect(
            screen.queryByRole('button', { name: 'Guardar política' }),
        ).toBeNull();
        expect(screen.queryByLabelText('Devolución %')).toBeNull();
    });

    it('makes the evidence and customer-penalty boundaries explicit', () => {
        render(<DecommissionPolicyManager policies={[]} />);

        expect(screen.getByText('Evidencia y aprobación admin')).toBeTruthy();
        expect(
            screen.getByText(
                'No aplica si la permanencia o la fecha de baja son desconocidas.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'No representa una penalización económica al cliente.',
            ),
        ).toBeTruthy();
    });

    it('keeps prior marketer policies as read-only history', () => {
        render(
            <DecommissionPolicyManager
                policies={[
                    {
                        id: 'policy-1',
                        name: 'Histórica',
                        marketerName: 'Naturgy',
                        productCode: 'Luz 2.0TD',
                        version: 2,
                        consolidationDays: 30,
                        clawbackDays: 180,
                        effectiveFrom: '2026-01-01T00:00:00Z',
                        bands: [],
                    },
                ]}
            />,
        );

        fireEvent.click(screen.getByText('Políticas anteriores (1)'));
        expect(screen.getByText('Naturgy · Luz 2.0TD')).toBeTruthy();
        expect(screen.getByText('v2 · ventana de 180 días')).toBeTruthy();
    });
});

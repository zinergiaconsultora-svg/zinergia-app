import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamAdminWorkspace } from '../TeamAdminWorkspace';

vi.mock('../AgentsManagement', () => ({
    default: () => <div>Personas del equipo</div>,
}));

vi.mock('@/features/network/components/ManageNetworkView', () => ({
    ManageNetworkView: () => <div>Estructura de la red</div>,
}));

describe('TeamAdminWorkspace', () => {
    it('combines people and network structure in one module', () => {
        render(<TeamAdminWorkspace agents={[]} franchises={[]} />);

        expect(screen.getByRole('heading', { name: 'Equipo y red' })).toBeTruthy();
        expect(screen.getByText('Personas del equipo')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Estructura comercial' }));

        expect(screen.getByText('Estructura de la red')).toBeTruthy();
    });
});

import { describe, expect, it } from 'vitest';
import { buildProposalsEmptyState } from '../emptyState';

describe('buildProposalsEmptyState', () => {
    it('guides agents to the simulator when there are no proposals and no filters', () => {
        expect(buildProposalsEmptyState({
            statusFilter: 'all',
            hasSearch: false,
            hasAdvancedFilters: false,
        })).toMatchObject({
            title: 'Sin propuestas todavía',
            actionKind: 'open-simulator',
            actionLabel: 'Abrir simulador',
            description: expect.stringContaining('guarda la propuesta en CRM'),
        });
    });

    it('prioritizes search or advanced filter guidance over status guidance', () => {
        expect(buildProposalsEmptyState({
            statusFilter: 'accepted',
            hasSearch: true,
            hasAdvancedFilters: false,
        })).toMatchObject({
            title: 'Sin resultados con estos filtros',
            actionKind: 'clear-filters',
        });

        expect(buildProposalsEmptyState({
            statusFilter: 'sent',
            hasSearch: false,
            hasAdvancedFilters: true,
        }).description).toContain('Relaja la búsqueda');
    });

    it('explains empty status tabs', () => {
        expect(buildProposalsEmptyState({ statusFilter: 'sent', hasSearch: false, hasAdvancedFilters: false }).title)
            .toBe('No hay propuestas enviadas con estos filtros');
        expect(buildProposalsEmptyState({ statusFilter: 'accepted', hasSearch: false, hasAdvancedFilters: false }).description)
            .toContain('alta, comisión y documentación');
        expect(buildProposalsEmptyState({ statusFilter: 'draft', hasSearch: false, hasAdvancedFilters: false }).description)
            .toContain('guardar una simulación');
        expect(buildProposalsEmptyState({ statusFilter: 'rejected', hasSearch: false, hasAdvancedFilters: false }).description)
            .toContain('recuperar contexto');
    });
});

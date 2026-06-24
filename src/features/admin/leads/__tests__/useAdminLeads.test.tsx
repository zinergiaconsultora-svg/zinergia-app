import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminLeadsAction, type InvoiceRegistryRow } from '@/app/actions/invoices';
import { useAdminLeads } from '../useAdminLeads';

vi.mock('@/app/actions/invoices', () => ({
    getAdminLeadsAction: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}));

const getAdminLeadsActionMock = vi.mocked(getAdminLeadsAction);

function lead(overrides: Partial<InvoiceRegistryRow> = {}): InvoiceRegistryRow {
    return {
        job_id: 'lead-1',
        agent_id: 'agent-1',
        franchise_id: null,
        created_at: '2026-06-01T10:00:00.000Z',
        ocr_status: 'completed',
        compared_at: null,
        drive_view_link: null,
        drive_synced_at: null,
        archived_in_drive: false,
        process_status: 'ocr_done',
        titular: 'Maria Lopez',
        comercializadora_actual: 'Actual',
        cups: null,
        importe_total: null,
        tarifa_actual: null,
        closed: false,
        lost: false,
        lost_reason: null,
        compania_contratada: null,
        tarifa_contratada: null,
        permanencia_hasta: null,
        commission_amount: null,
        closed_at: null,
        agent_name: 'Comercial',
        franchise_name: null,
        period_days: null, annual_savings: null, savings_percent: null, has_proposal: false, reviewed_at: null,
        ...overrides,
    };
}

describe('useAdminLeads', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('starts from the filters parsed from the current URL', () => {
        const { result } = renderHook(() => useAdminLeads([lead()], {
            outcome: 'lost',
            search: 'Maria',
        }));

        expect(result.current.filters).toEqual({ outcome: 'lost', search: 'Maria' });
        expect(result.current.leads).toHaveLength(1);
    });

    it('exposes a visible error when loading filtered leads fails', async () => {
        getAdminLeadsActionMock.mockRejectedValueOnce(new Error('network'));
        const { result } = renderHook(() => useAdminLeads([], { outcome: 'open' }));

        await act(async () => {
            await result.current.applyFilters({ outcome: 'won' });
        });

        expect(result.current.error).toBe('No se pudieron cargar los leads. Inténtalo de nuevo.');
        expect(result.current.filters).toEqual({ outcome: 'won' });
    });
});

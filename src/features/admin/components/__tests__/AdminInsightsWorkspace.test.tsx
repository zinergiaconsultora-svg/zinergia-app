import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminInsightsWorkspace } from '../AdminInsightsWorkspace';

vi.mock('../BusinessMetricsPanel', () => ({
    default: () => <div>Resumen consolidado</div>,
}));

vi.mock('../ReportingDashboard', () => ({
    default: () => <div>Tendencias consolidadas</div>,
}));

describe('AdminInsightsWorkspace', () => {
    it('combines indicators and trends in one understandable module', () => {
        render(
            <AdminInsightsWorkspace
                metrics={{
                    funnel: [],
                    topMarketers: [],
                    franchiseRanking: [],
                    last30: {
                        ocr_jobs: 0,
                        proposals_created: 0,
                        proposals_accepted: 0,
                        total_savings: 0,
                    },
                }}
                commissionData={[]}
                proposalData={[]}
                agentRanking={[]}
            />,
        );

        expect(screen.getByRole('heading', { name: 'Informes' })).toBeTruthy();
        expect(screen.getByText('Resumen consolidado')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Tendencias y ranking' }));

        expect(screen.getByText('Tendencias consolidadas')).toBeTruthy();
    });
});

import { describe, expect, it } from 'vitest';
import {
    buildAdminLeadQueryString,
    parseAdminLeadFilters,
} from '../filters';

describe('admin lead filters', () => {
    it('parses valid URL filters and trims free text search', () => {
        const params = new URLSearchParams({
            outcome: 'lost',
            queue: 'drive_pending',
            search: '  Maria Lopez  ',
            agentId: 'agent-1',
            franchiseId: 'franchise-1',
        });

        expect(parseAdminLeadFilters(params)).toEqual({
            outcome: 'lost',
            queue: 'drive_pending',
            search: 'Maria Lopez',
            agentId: 'agent-1',
            franchiseId: 'franchise-1',
        });
    });

    it('falls back to open leads and drops empty values', () => {
        const params = new URLSearchParams({
            outcome: 'stale',
            queue: 'unknown',
            search: '   ',
            agentId: '',
        });

        expect(parseAdminLeadFilters(params)).toEqual({ outcome: 'open' });
    });

    it('builds a stable query string for shareable admin views', () => {
        expect(buildAdminLeadQueryString({
            outcome: 'won',
            queue: 'permanence_due',
            search: 'Empresa Solar',
            agentId: 'agent-2',
        })).toBe('outcome=won&queue=permanence_due&search=Empresa+Solar&agentId=agent-2');
    });
});

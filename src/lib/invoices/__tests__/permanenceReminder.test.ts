import { describe, it, expect } from 'vitest';
import { buildPermanenceReminder } from '../permanenceReminder';

describe('buildPermanenceReminder', () => {
    it('builds a warning reminder naming the company and date', () => {
        const r = buildPermanenceReminder({ company: 'Endesa', permanenceUntil: '2027-01-15' });
        expect(r.type).toBe('warning');
        expect(r.title).toBe('Permanencia próxima a vencer');
        expect(r.message).toContain('Endesa');
        expect(r.message).toContain('2027');
        expect(r.link).toBe('/dashboard/invoices');
    });

    it('falls back gracefully when the company is missing', () => {
        const r = buildPermanenceReminder({ company: null, permanenceUntil: '2027-01-15' });
        expect(r.message).toContain('la compañía contratada');
    });
});

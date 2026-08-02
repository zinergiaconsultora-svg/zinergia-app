import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260801154820_atomic_fiscal_commission_invoicing.sql'),
    'utf8',
);

describe('atomic fiscal commission invoicing migration', () => {
    it('prevents one active commission from being billed twice', () => {
        expect(migration).toMatch(/CREATE UNIQUE INDEX fiscal_invoice_active_commission_idx[\s\S]*WHERE adjustment_id IS NULL AND released_at IS NULL/);
        expect(migration).toContain('cardinality(p_commission_ids) <> (SELECT count(DISTINCT value)');
    });

    it('reserves commissions with the created invoice id without ambiguous assignment', () => {
        expect(migration).toContain('SET invoice_id = created_invoice_id');
        expect(migration).not.toContain('SET invoice_id = invoice_id');
    });

    it('keeps fiscal mutations behind service-only RPCs', () => {
        expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM PUBLIC, anon, authenticated');
        expect(migration).toContain('REVOKE ALL ON FUNCTION public.create_commission_invoice_draft(uuid,uuid[],uuid) FROM PUBLIC, anon, authenticated');
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.create_commission_invoice_draft(uuid,uuid[],uuid) TO service_role');
        expect(migration).toContain('REVOKE ALL ON FUNCTION public.generate_invoice_number(uuid) FROM PUBLIC, anon, authenticated');
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.configure_fiscal_organization(uuid,text,text,text,text,text,text) TO service_role');
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.get_fiscal_admin_setup(uuid) TO service_role');
        expect(migration).toContain('CREATE TRIGGER guard_fiscal_profile_mutation');
        expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    });

    it('keeps fiscal reads scoped to commercial, supervising franchise or admin', () => {
        expect(migration).toMatch(/self_billing_agreements_scoped_read[\s\S]*commercial\.parent_id = \(select auth\.uid\(\)\)/);
        expect(migration).toMatch(/fiscal_lines_scoped_read[\s\S]*commercial\.parent_id = \(select auth\.uid\(\)\)/);
        expect(migration).toMatch(/rectification_requests_scoped_read[\s\S]*commission\.franchise_id = \(select auth\.uid\(\)\)/);
        expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    });

    it('requires exact atomic lifecycle transitions for every normalized line', () => {
        expect(migration).toContain("IF affected_count <> expected_count OR expected_count = 0 THEN");
        expect(migration).toContain("SET lifecycle_status = 'invoiced'");
        expect(migration).toContain("SET lifecycle_status = 'paid'");
    });

    it('models lawful self-billing acceptance and linked rectifications', () => {
        expect(migration).toContain('accepted self-billing agreement required');
        expect(migration).toContain("acceptance_status = 'accepted'");
        expect(migration).toContain("document_kind = 'rectifying_invoice' AND source_invoice_id IS NOT NULL");
        expect(migration).toContain('NEW.commercial_amount > 0');
    });

    it('uses the commercial as issuer and Zinergia as recipient', () => {
        expect(migration).toMatch(/coalesce\(commercial\.company_name,[\s\S]*commercial\.nif_cif,[\s\S]*organization\.legal_name, organization\.nif/);
    });
});

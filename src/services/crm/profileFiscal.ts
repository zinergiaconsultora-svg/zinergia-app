import { FiscalProfile, type CompanyType, isProfileReadyForInvoicing } from '@/types/crm';
import { getOwnFiscalProfileAction } from '@/app/actions/invoicing';

export type ProtectedFiscalProfile = {
    nif_cif?: string | null;
    fiscal_address?: string | null;
    fiscal_city?: string | null;
    fiscal_province?: string | null;
    fiscal_postal_code?: string | null;
    fiscal_country?: string | null;
    company_name?: string | null;
    company_type?: CompanyType | null;
    invoice_prefix?: string | null;
    retention_percent?: number | null;
    invoice_tax_percent?: number | null;
    fiscal_verified?: boolean | null;
    fiscal_verified_at?: string | null;
    hasIban: boolean;
    maskedIban: string | null;
};

export const profileFiscalService = {

    async getFiscalProfile(): Promise<ProtectedFiscalProfile | null> {
        const result = await getOwnFiscalProfileAction();
        return result.success ? result.data : null;
    },

    async getFiscalReadiness(): Promise<{ ready: boolean; missing: string[] }> {
        const profile = await this.getFiscalProfile();
        if (!profile) return { ready: false, missing: ['Perfil no encontrado'] };
        const readinessProfile: FiscalProfile = {
            nif_cif: profile.nif_cif ?? undefined,
            fiscal_address: profile.fiscal_address ?? undefined,
            fiscal_city: profile.fiscal_city ?? undefined,
            fiscal_province: profile.fiscal_province ?? undefined,
            fiscal_postal_code: profile.fiscal_postal_code ?? undefined,
            invoice_tax_percent: profile.invoice_tax_percent ?? undefined,
            fiscal_verified: profile.fiscal_verified ?? undefined,
            iban: profile.hasIban ? 'configured' : undefined,
        };
        return isProfileReadyForInvoicing(readinessProfile);
    }
};

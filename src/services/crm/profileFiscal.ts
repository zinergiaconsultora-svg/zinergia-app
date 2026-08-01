import { createClient } from '@/lib/supabase/client';
import { FiscalProfile, isProfileReadyForInvoicing } from '@/types/crm';

const FISCAL_FIELDS = [
    'nif_cif', 'fiscal_address', 'fiscal_city', 'fiscal_province',
    'fiscal_postal_code', 'fiscal_country', 'iban', 'company_name',
    'company_type', 'invoice_prefix', 'invoice_next_number',
    'retention_percent', 'invoice_tax_percent', 'fiscal_verified', 'fiscal_verified_at'
].join(', ');

export const profileFiscalService = {

    async getFiscalProfile(): Promise<FiscalProfile | null> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select(FISCAL_FIELDS)
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('[profileFiscalService] Error fetching:', error);
            return null;
        }
        return data as FiscalProfile;
    },

    async getFiscalReadiness(): Promise<{ ready: boolean; missing: string[] }> {
        const profile = await this.getFiscalProfile();
        if (!profile) return { ready: false, missing: ['Perfil no encontrado'] };
        return isProfileReadyForInvoicing(profile);
    }
};

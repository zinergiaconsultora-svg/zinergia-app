import { createClient } from '@/lib/supabase/client';
import { FiscalProfile, isProfileReadyForInvoicing } from '@/types/crm';

const FISCAL_FIELDS = [
    'nif_cif', 'fiscal_address', 'fiscal_city', 'fiscal_province',
    'fiscal_postal_code', 'fiscal_country', 'iban', 'company_name',
    'company_type', 'invoice_prefix', 'invoice_next_number',
    'retention_percent', 'fiscal_verified', 'fiscal_verified_at'
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

    async updateFiscalProfile(updates: Partial<FiscalProfile>): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'No autenticado' };

        if (updates.iban) {
            const ibanClean = updates.iban.replace(/\s/g, '').toUpperCase();
            if (!/^[A-Z]{2}\d{22}$/.test(ibanClean) && !/^[A-Z]{2}\d{2}\d{4}\d{4}\d{4}\d{4}\d{4}\d{4}$/.test(ibanClean)) {
                return { success: false, error: 'IBAN no válido. Formato esperado: ES00 0000 0000 0000 0000 0000' };
            }
            updates.iban = ibanClean;
        }

        if (updates.nif_cif) {
            const nif = updates.nif_cif.toUpperCase().trim();
            const nifRegex = /^(\d{8}[A-Z]|[A-Z]\d{7}[A-Z0-9]|[A-Z]{2}\d{6}[A-Z0-9])$/;
            if (!nifRegex.test(nif)) {
                return { success: false, error: 'NIF/CIF no válido' };
            }
            updates.nif_cif = nif;
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                ...updates,
                fiscal_verified: false,
                fiscal_verified_at: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (error) {
            console.error('[profileFiscalService] Error updating:', error);
            return { success: false, error: error.message };
        }
        return { success: true };
    },

    async getFiscalReadiness(): Promise<{ ready: boolean; missing: string[] }> {
        const profile = await this.getFiscalProfile();
        if (!profile) return { ready: false, missing: ['Perfil no encontrado'] };
        return isProfileReadyForInvoicing(profile);
    },

    async verifyFiscalProfile(userId: string): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();
        const { error } = await supabase
            .from('profiles')
            .update({
                fiscal_verified: true,
                fiscal_verified_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) return { success: false, error: error.message };
        return { success: true };
    }
};
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
    return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ZIN-SDD-041 protected profile consumers', () => {
    it('loads wallet identity through the protected server action, never a browser profile query', () => {
        const wallet = source('src/features/gamification/hooks/useWallet.ts');

        expect(wallet).toContain('getOwnWalletIdentityAction');
        expect(wallet).not.toMatch(/\.from\(\s*['"]profiles['"]\s*\)/);
        expect(wallet).not.toMatch(/select\(\s*['"]role, iban['"]\s*\)/);
    });

    it('keeps profileFiscalService as an action adapter with no browser Supabase client', () => {
        const fiscalService = source('src/services/crm/profileFiscal.ts');

        expect(fiscalService).toContain('getOwnFiscalProfileAction');
        expect(fiscalService).not.toMatch(/from\s+['"]@\/lib\/supabase\/client['"]/);
        expect(fiscalService).not.toMatch(/\.from\(\s*['"]profiles['"]\s*\)/);
        expect(fiscalService).not.toMatch(/console\.(?:log|error|warn)/);
    });

    it('does not resubmit a masked IBAN as part of the fiscal profile payload', () => {
        const fiscalForm = source('src/features/crm/components/FiscalProfileForm.tsx');

        expect(fiscalForm).toContain('maskedIban');
        expect(fiscalForm).toContain('saveIbanAction');
        expect(fiscalForm).not.toMatch(/['"]iban['"]\s*,\s*['"]company_name['"]/);
        expect(fiscalForm).not.toMatch(/value=\{profile\.iban\s*\|\|\s*['"]['"]\}/);
    });

    it('renders the server-provided wallet mask without attempting to mask it again', () => {
        const withdrawModal = source('src/features/gamification/components/WithdrawModal.tsx');

        expect(withdrawModal).not.toMatch(/maskIban\(iban\)/);
        expect(withdrawModal).toMatch(/\{iban\s*\?\s*iban\s*:\s*['"]No configurado['"]\}/);
    });
});

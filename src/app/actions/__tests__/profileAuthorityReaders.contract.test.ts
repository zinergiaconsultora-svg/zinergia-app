import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    createBrowserClientMock,
    createServerClientMock,
    createServiceClientMock,
    requireServerRoleMock,
    revalidatePathMock,
} = vi.hoisted(() => ({
    createBrowserClientMock: vi.fn(),
    createServerClientMock: vi.fn(),
    createServiceClientMock: vi.fn(),
    requireServerRoleMock: vi.fn(),
    revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ createClient: createBrowserClientMock }));
vi.mock('@/lib/supabase/server', () => ({ createClient: createServerClientMock }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: createServiceClientMock }));
vi.mock('@/lib/auth/permissions', () => ({ requireServerRole: requireServerRoleMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../notifications', () => ({ createNotificationInternal: vi.fn() }));

import { profileFiscalService } from '@/services/crm/profileFiscal';
import * as invoicingActions from '../invoicing';
import * as withdrawalActions from '../withdrawals';

type ActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

type WalletIdentity = {
    role: 'admin' | 'franchise' | 'agent';
    hasIban: boolean;
    maskedIban: string | null;
};

type FiscalProfile = {
    company_name: string | null;
    fiscal_verified: boolean;
    hasIban: boolean;
    maskedIban: string | null;
};

type GetOwnWalletIdentity = () => Promise<ActionResult<WalletIdentity>>;
type GetOwnFiscalProfile = () => Promise<ActionResult<FiscalProfile>>;

const actorId = '11111111-1111-4111-8111-111111111111';
const fullIban = 'ES9121000418450200051332';
const maskedIban = 'ES••••••••••••••••••1332';
const WALLET_PROFILE_FIELDS = 'role, iban';
const FISCAL_PROFILE_FIELDS = [
    'nif_cif', 'fiscal_address', 'fiscal_city', 'fiscal_province',
    'fiscal_postal_code', 'fiscal_country', 'company_name', 'company_type',
    'invoice_prefix', 'retention_percent', 'invoice_tax_percent',
    'fiscal_verified', 'fiscal_verified_at', 'iban',
].join(', ');

function requireContract<T>(module: object, exportName: string): T {
    const candidate = (module as Record<string, unknown>)[exportName];
    expect(candidate, `${exportName} contract is not implemented`).toBeTypeOf('function');
    return candidate as T;
}

function sessionClient(extra: Record<string, unknown> = {}) {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: actorId } }, error: null }),
        },
        ...extra,
    };
}

function tableQuery(data: unknown) {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn().mockResolvedValue({ data, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
    return chain;
}

describe('ZIN-SDD-041 protected server reader actions (RED)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        createServerClientMock.mockResolvedValue(sessionClient());
    });

    it('authorizes getOwnWalletIdentityAction and returns role, presence and a meaningful mask', async () => {
        const profileQuery = tableQuery({ role: 'agent', iban: fullIban });
        const serviceFrom = vi.fn().mockReturnValue(profileQuery);
        createServiceClientMock.mockReturnValue({ from: serviceFrom });
        const getOwnWalletIdentity = requireContract<GetOwnWalletIdentity>(
            withdrawalActions,
            'getOwnWalletIdentityAction',
        );

        const result = await getOwnWalletIdentity();

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin', 'franchise', 'agent']);
        expect(createServerClientMock).toHaveBeenCalledTimes(1);
        expect(serviceFrom).toHaveBeenCalledWith('profiles');
        expect(profileQuery.select).toHaveBeenCalledWith(WALLET_PROFILE_FIELDS);
        expect(profileQuery.eq).toHaveBeenCalledWith('id', actorId);
        expect(result).toEqual({
            success: true,
            data: { role: 'agent', hasIban: true, maskedIban },
        });
        expect(JSON.stringify(result)).not.toContain(fullIban);
        expect(createBrowserClientMock).not.toHaveBeenCalled();
    });

    it('authorizes getOwnFiscalProfileAction and never returns the stored full IBAN', async () => {
        const profileQuery = tableQuery({
            company_name: 'Consultoría SL',
            fiscal_verified: true,
            iban: fullIban,
        });
        const serviceFrom = vi.fn().mockReturnValue(profileQuery);
        createServiceClientMock.mockReturnValue({ from: serviceFrom });
        const getOwnFiscalProfile = requireContract<GetOwnFiscalProfile>(
            invoicingActions,
            'getOwnFiscalProfileAction',
        );

        const result = await getOwnFiscalProfile();

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin', 'franchise', 'agent']);
        expect(createServerClientMock).toHaveBeenCalledTimes(1);
        expect(serviceFrom).toHaveBeenCalledWith('profiles');
        expect(profileQuery.select).toHaveBeenCalledWith(FISCAL_PROFILE_FIELDS);
        expect(profileQuery.eq).toHaveBeenCalledWith('id', actorId);
        expect(result).toEqual({
            success: true,
            data: {
                company_name: 'Consultoría SL',
                fiscal_verified: true,
                hasIban: true,
                maskedIban,
            },
        });
        expect(JSON.stringify(result)).not.toContain(fullIban);
        expect(createBrowserClientMock).not.toHaveBeenCalled();
    });
});

describe('ZIN-SDD-041 reader compatibility adapters (RED)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
    });

    it('adapts getIbanAction to the wallet identity response instead of exposing a scalar IBAN', async () => {
        const directQuery = tableQuery({ iban: fullIban });
        const sessionFrom = vi.fn().mockReturnValue(directQuery);
        createServerClientMock.mockResolvedValue(sessionClient({
            from: sessionFrom,
        }));
        const protectedQuery = tableQuery({ role: 'agent', iban: fullIban });
        const serviceFrom = vi.fn().mockReturnValue(protectedQuery);
        createServiceClientMock.mockReturnValue({ from: serviceFrom });

        const result = await withdrawalActions.getIbanAction();

        expect(sessionFrom).not.toHaveBeenCalledWith('profiles');
        expect(serviceFrom).toHaveBeenCalledWith('profiles');
        expect(protectedQuery.select).toHaveBeenCalledWith(WALLET_PROFILE_FIELDS);
        expect(protectedQuery.eq).toHaveBeenCalledWith('id', actorId);
        expect(result).toEqual({ role: 'agent', hasIban: true, maskedIban });
        expect(JSON.stringify(result)).not.toContain(fullIban);
        expect(createBrowserClientMock).not.toHaveBeenCalled();
    });

    it('keeps the browser fiscal service free of direct session/profile reads', async () => {
        const browserAuth = {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: actorId } }, error: null }),
        };
        const browserFrom = vi.fn().mockReturnValue(tableQuery({
            company_name: 'Consultoría SL',
            fiscal_verified: true,
            iban: fullIban,
        }));
        createBrowserClientMock.mockReturnValue({ auth: browserAuth, from: browserFrom });
        createServerClientMock.mockResolvedValue(sessionClient());
        createServiceClientMock.mockReturnValue({
            from: vi.fn().mockReturnValue(tableQuery({
                company_name: 'Consultoría SL',
                fiscal_verified: true,
                iban: fullIban,
            })),
        });

        const result = await profileFiscalService.getFiscalProfile();

        expect(createBrowserClientMock).not.toHaveBeenCalled();
        expect(browserAuth.getUser).not.toHaveBeenCalled();
        expect(browserFrom).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            company_name: 'Consultoría SL',
            fiscal_verified: true,
            hasIban: true,
            maskedIban,
        });
        expect(result).not.toHaveProperty('iban');
    });

    it('accepts only an explicit full replacement and routes it through the banking workflow', async () => {
        const directUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
        createServerClientMock.mockResolvedValue(sessionClient({
            from: vi.fn().mockReturnValue({ update: directUpdate }),
        }));
        const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
        createServiceClientMock.mockReturnValue({ rpc });

        const maskedAttempt = await withdrawalActions.saveIbanAction(maskedIban);
        const replacement = await withdrawalActions.saveIbanAction(fullIban);

        expect(maskedAttempt).toEqual({
            success: false,
            error: 'Introduce el IBAN completo para sustituir el actual.',
        });
        expect(replacement).toEqual({ success: true });
        expect(rpc).toHaveBeenCalledWith('update_own_iban', {
            p_actor_id: actorId,
            p_iban: fullIban,
        });
        expect(directUpdate).not.toHaveBeenCalled();
    });

    it('reads the full IBAN only inside the authorized withdrawal workflow', async () => {
        const directProfileQuery = tableQuery({ iban: fullIban });
        const commissionsEq = vi.fn().mockResolvedValue({
            data: [{ id: 'commission-1', status: 'cleared', agent_commission: 100 }],
            error: null,
        });
        const sessionFrom = vi.fn((table: string) => {
            if (table === 'profiles') return directProfileQuery;
            if (table === 'network_commissions') {
                return {
                    select: vi.fn().mockReturnValue({
                        in: vi.fn().mockReturnValue({ eq: commissionsEq }),
                    }),
                };
            }
            return {
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { id: 'withdrawal-1', iban: fullIban },
                            error: null,
                        }),
                    }),
                }),
            };
        });
        createServerClientMock.mockResolvedValue(sessionClient({ from: sessionFrom }));
        const protectedProfileQuery = tableQuery({ iban: fullIban });
        const serviceFrom = vi.fn().mockReturnValue(protectedProfileQuery);
        createServiceClientMock.mockReturnValue({ from: serviceFrom });

        const result = await withdrawalActions.createWithdrawalRequestAction(100, ['commission-1']);

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin', 'franchise', 'agent']);
        expect(sessionFrom).not.toHaveBeenCalledWith('profiles');
        expect(serviceFrom).toHaveBeenCalledWith('profiles');
        expect(protectedProfileQuery.select).toHaveBeenCalledWith('iban');
        expect(protectedProfileQuery.eq).toHaveBeenCalledWith('id', actorId);
        expect(result.success).toBe(true);
        expect(JSON.stringify(result)).not.toContain(fullIban);
    });
});

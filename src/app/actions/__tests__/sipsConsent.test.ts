import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    requireServerRoleMock,
    createClientMock,
    rpcMock,
    hashCupsMock,
    sipsEnabledMock,
} = vi.hoisted(() => ({
    requireServerRoleMock: vi.fn(),
    createClientMock: vi.fn(),
    rpcMock: vi.fn(),
    hashCupsMock: vi.fn(() => 'c'.repeat(64)),
    sipsEnabledMock: vi.fn(() => true),
}));

vi.mock('@/lib/auth/permissions', () => ({ requireServerRole: requireServerRoleMock }));
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/crypto/pii', () => ({ hashCups: hashCupsMock }));
vi.mock('@/lib/sips/authorization', () => ({ isLiveSipsAccessEnabled: sipsEnabledMock }));
vi.mock('@/lib/cnmc/sips', () => ({
    isValidCups: (value: string) => value.startsWith('ES') && value.length >= 20,
    normalizeCups: (value: string) => value.toUpperCase().replace(/\s/g, ''),
}));

import {
    getSipsConsentStatusAction,
    recordSipsConsentAction,
    revokeSipsConsentAction,
} from '../sipsConsent';

const VALID_CUPS = 'ES0031102868105034EP';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const CONSENT_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
    createClientMock.mockResolvedValue({ rpc: rpcMock });
    requireServerRoleMock.mockResolvedValue(undefined);
    sipsEnabledMock.mockReturnValue(true);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('recordSipsConsentAction', () => {
    it('authorizes the caller before touching the database', async () => {
        rpcMock.mockResolvedValue({ data: { consent_id: CONSENT_ID, created: true }, error: null });

        await recordSipsConsentAction({ cups: VALID_CUPS, clientId: CLIENT_ID, source: 'verbal_visit' });

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin', 'franchise', 'agent']);
    });

    it('sends the blind index and never the raw CUPS', async () => {
        rpcMock.mockResolvedValue({ data: { consent_id: CONSENT_ID, created: true }, error: null });

        await recordSipsConsentAction({ cups: VALID_CUPS, clientId: CLIENT_ID, source: 'signed_document' });

        const [name, args] = rpcMock.mock.calls[0];
        expect(name).toBe('record_sips_consent');
        expect(JSON.stringify(args)).not.toContain(VALID_CUPS);
        expect(args).toMatchObject({ p_cups_hash: 'c'.repeat(64), p_consent_source: 'signed_document' });
    });

    it('reports an idempotent repeat as not created', async () => {
        rpcMock.mockResolvedValue({ data: { consent_id: CONSENT_ID, created: false }, error: null });

        const result = await recordSipsConsentAction({ cups: VALID_CUPS, clientId: CLIENT_ID, source: 'email' });

        expect(result).toEqual({ success: true, data: { consentId: CONSENT_ID, created: false } });
    });

    it('rejects an invalid CUPS before reaching the database', async () => {
        const result = await recordSipsConsentAction({ cups: 'FR00311028681050', source: 'email' });

        expect(result.success).toBe(false);
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('rejects an unknown consent source before reaching the database', async () => {
        const result = await recordSipsConsentAction({
            cups: VALID_CUPS,
            source: 'whatever' as 'email',
        });

        expect(result.success).toBe(false);
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('accepts a prospecting capture with no client attached', async () => {
        rpcMock.mockResolvedValue({ data: { consent_id: CONSENT_ID, created: true }, error: null });

        const result = await recordSipsConsentAction({ cups: VALID_CUPS, source: 'verbal_visit' });

        expect(result.success).toBe(true);
        expect(rpcMock.mock.calls[0][1]).toMatchObject({ p_client_id: null });
    });

    it('fails closed and hides the reason when the command denies', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'CONSENT_NOT_AUTHORIZED' } });

        const result = await recordSipsConsentAction({ cups: VALID_CUPS, clientId: CLIENT_ID, source: 'email' });

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).not.toMatch(/CONSENT_NOT_AUTHORIZED/);
    });

    it('fails closed when the command returns no consent id', async () => {
        rpcMock.mockResolvedValue({ data: { created: true }, error: null });

        await expect(recordSipsConsentAction({ cups: VALID_CUPS, source: 'email' }))
            .resolves.toMatchObject({ success: false });
    });
});

describe('revokeSipsConsentAction', () => {
    it('revokes a consent by id', async () => {
        rpcMock.mockResolvedValue({ data: { consent_id: CONSENT_ID, revoked: true }, error: null });

        const result = await revokeSipsConsentAction(CONSENT_ID);

        expect(result.success).toBe(true);
        expect(rpcMock).toHaveBeenCalledWith('revoke_sips_consent', { p_consent_id: CONSENT_ID });
    });

    it('rejects a non-uuid without calling the database', async () => {
        const result = await revokeSipsConsentAction('not-a-uuid');

        expect(result.success).toBe(false);
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('does not report success when the command did not revoke', async () => {
        rpcMock.mockResolvedValue({ data: { revoked: false }, error: null });

        await expect(revokeSipsConsentAction(CONSENT_ID)).resolves.toMatchObject({ success: false });
    });
});

describe('getSipsConsentStatusAction', () => {
    // With SIPS off there is nothing to consent to, so the UI must render nothing rather
    // than prompt for an authorization the agent cannot use.
    it('reports SIPS as disabled without querying anything', async () => {
        sipsEnabledMock.mockReturnValue(false);

        await expect(getSipsConsentStatusAction(VALID_CUPS, CLIENT_ID))
            .resolves.toEqual({ sipsEnabled: false, hasActiveConsent: false });
        expect(rpcMock).not.toHaveBeenCalled();
        expect(requireServerRoleMock).not.toHaveBeenCalled();
    });

    it('maps an active consent', async () => {
        rpcMock.mockResolvedValue({
            data: {
                has_active_consent: true,
                consent_id: CONSENT_ID,
                consent_at: '2026-08-04T10:00:00.000Z',
                consent_source: 'verbal_visit',
                captured_by_me: true,
            },
            error: null,
        });

        await expect(getSipsConsentStatusAction(VALID_CUPS, CLIENT_ID)).resolves.toEqual({
            sipsEnabled: true,
            hasActiveConsent: true,
            consentId: CONSENT_ID,
            consentAt: '2026-08-04T10:00:00.000Z',
            consentSource: 'verbal_visit',
            capturedByMe: true,
        });
    });

    // A truthy-but-not-true flag must never render as "authorised" in the UI.
    it.each([
        ['string true', { has_active_consent: 'true', consent_id: CONSENT_ID }],
        ['number one', { has_active_consent: 1 }],
        ['missing flag', { consent_id: CONSENT_ID }],
    ])('reports no consent when the flag is not a real true (%s)', async (_label, payload) => {
        rpcMock.mockResolvedValue({ data: payload, error: null });

        await expect(getSipsConsentStatusAction(VALID_CUPS, CLIENT_ID))
            .resolves.toEqual({ sipsEnabled: true, hasActiveConsent: false });
    });

    it('reports no consent when the query errors', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'timeout' } });

        await expect(getSipsConsentStatusAction(VALID_CUPS, CLIENT_ID))
            .resolves.toEqual({ sipsEnabled: true, hasActiveConsent: false });
    });

    it('reports no consent for an invalid CUPS without querying', async () => {
        await expect(getSipsConsentStatusAction('nope')).resolves.toEqual({ sipsEnabled: true, hasActiveConsent: false });
        expect(rpcMock).not.toHaveBeenCalled();
    });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { envMock } = vi.hoisted(() => ({
    envMock: { SIPS_LIVE_ACCESS_ENABLED: 'true' as 'true' | 'false' },
}));

vi.mock('@/lib/env', () => ({ env: envMock }));

import { authorizeSipsConsumption, isLiveSipsAccessEnabled } from '../authorization';

const CUPS_HASH = 'a'.repeat(64);

function clientReturning(data: unknown, error: unknown = null) {
    const rpc = vi.fn().mockResolvedValue({ data, error });
    return { client: { rpc }, rpc };
}

describe('SIPS authorization', () => {
    beforeEach(() => {
        envMock.SIPS_LIVE_ACCESS_ENABLED = 'true';
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('kill path', () => {
        it('reports live access enabled by default', () => {
            expect(isLiveSipsAccessEnabled()).toBe(true);
        });

        it('denies without consulting the database when access is disabled', async () => {
            envMock.SIPS_LIVE_ACCESS_ENABLED = 'false';
            const { client, rpc } = clientReturning({ allowed: true, reason: 'authorized' });

            const decision = await authorizeSipsConsumption(client, CUPS_HASH);

            expect(decision).toEqual({ allowed: false, reason: 'access_disabled' });
            expect(rpc).not.toHaveBeenCalled();
        });
    });

    describe('decision mapping', () => {
        it('authorizes only on an explicit allowed=true', async () => {
            const { client, rpc } = clientReturning({ allowed: true, reason: 'authorized' });

            await expect(authorizeSipsConsumption(client, CUPS_HASH))
                .resolves.toEqual({ allowed: true, reason: 'authorized' });
            expect(rpc).toHaveBeenCalledWith('authorize_sips_consumption', { p_cups_hash: CUPS_HASH });
        });

        it('passes through a safe denial reason', async () => {
            const { client } = clientReturning({ allowed: false, reason: 'no_active_consent' });

            await expect(authorizeSipsConsumption(client, CUPS_HASH))
                .resolves.toEqual({ allowed: false, reason: 'no_active_consent' });
        });

        // A truthy-but-not-true value must never be read as permission.
        it.each([
            ['string true', { allowed: 'true', reason: 'authorized' }],
            ['number one', { allowed: 1, reason: 'authorized' }],
            ['missing flag', { reason: 'authorized' }],
        ])('denies when allowed is not a real boolean true (%s)', async (_label, payload) => {
            const { client } = clientReturning(payload);

            const decision = await authorizeSipsConsumption(client, CUPS_HASH);

            expect(decision.allowed).toBe(false);
        });

        it('denies an unrecognised reason code instead of trusting it', async () => {
            const { client } = clientReturning({ allowed: false, reason: 'because_i_said_so' });

            await expect(authorizeSipsConsumption(client, CUPS_HASH))
                .resolves.toEqual({ allowed: false, reason: 'authorization_unavailable' });
        });

        it.each([
            ['null', null],
            ['a bare string', 'authorized'],
            ['an array', []],
        ])('denies a malformed payload (%s)', async (_label, payload) => {
            const { client } = clientReturning(payload);

            const decision = await authorizeSipsConsumption(client, CUPS_HASH);

            expect(decision.allowed).toBe(false);
        });
    });

    describe('fail closed', () => {
        it('denies when the authorization query returns an error', async () => {
            const { client } = clientReturning(null, { message: 'timeout' });

            await expect(authorizeSipsConsumption(client, CUPS_HASH))
                .resolves.toEqual({ allowed: false, reason: 'authorization_unavailable' });
        });

        it('denies when the authorization query throws', async () => {
            const client = { rpc: vi.fn().mockRejectedValue(new Error('connection lost')) };

            await expect(authorizeSipsConsumption(client, CUPS_HASH))
                .resolves.toEqual({ allowed: false, reason: 'authorization_unavailable' });
        });
    });
});

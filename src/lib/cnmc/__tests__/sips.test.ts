import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildSipsUrl,
    calculateElectricityAnnualConsumption,
    fetchSipsCsv,
    getCnmcOAuthConfig,
    isValidCups,
    normalizeCups,
    parseCsv,
} from '../sips';

const OAUTH_VARS = [
    'CNMC_OAUTH_CONSUMER_KEY',
    'CNMC_OAUTH_CONSUMER_SECRET',
    'CNMC_OAUTH_TOKEN',
    'CNMC_OAUTH_TOKEN_SECRET',
] as const;

describe('CNMC SIPS helpers', () => {
    it('normalizes and validates CUPS values', () => {
        expect(normalizeCups(' es0021000000000000aa1f ')).toBe('ES0021000000000000AA1F');
        expect(isValidCups('ES0021000000000000AA1F')).toBe(true);
        expect(isValidCups('bad-cups')).toBe(false);
    });

    it('builds the CNMC individual query URL for electricity consumptions', () => {
        expect(buildSipsUrl('SIPS2_CONSUMOS_ELECTRICIDAD', 'ES0021000000000000AA1F')).toBe(
            'https://api.cnmc.gob.es/verticales/v1/SIPS/consulta/v1/SIPS2_CONSUMOS_ELECTRICIDAD.csv?cups=ES0021000000000000AA1F',
        );
    });

    it('parses semicolon CSV responses', () => {
        const rows = parseCsv([
            'cups;consumoEnergiaActivaEnWhP1;consumoEnergiaActivaEnWhP2',
            'ES0021000000000000AA1F;1000;2.000',
        ].join('\n'));

        expect(rows).toEqual([
            {
                cups: 'ES0021000000000000AA1F',
                consumoEnergiaActivaEnWhP1: '1000',
                consumoEnergiaActivaEnWhP2: '2.000',
            },
        ]);
    });

    it('sums active energy P1-P6 in Wh and converts it to kWh and MWh', () => {
        const csv = [
            'cups;consumoEnergiaActivaEnWhP1;consumoEnergiaActivaEnWhP2;consumoEnergiaActivaEnWhP3;consumoEnergiaActivaEnWhP4;consumoEnergiaActivaEnWhP5;consumoEnergiaActivaEnWhP6',
            'ES0021000000000000AA1F;1000000;2000000;3000000;4000000;5000000;6000000',
            'ES0021000000000000AA1F;500000;500000;500000;500000;500000;500000',
        ].join('\n');

        const result = calculateElectricityAnnualConsumption('ES0021000000000000AA1F', csv);

        expect(result.rows).toBe(2);
        expect(result.annualKwh).toBe(24000);
        expect(result.annualMwh).toBe(24);
    });
});

/**
 * The OAuth path was entirely uncovered. It matters twice over: it decides whether the
 * integration fails closed when it is not configured — which is exactly the state Zinergia
 * is in today — and it signs every request that reaches the CNMC.
 */
describe('CNMC SIPS OAuth', () => {
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const name of OAUTH_VARS) {
            savedEnv[name] = process.env[name];
            process.env[name] = `test-${name.toLowerCase()}`;
        }
    });

    afterEach(() => {
        for (const name of OAUTH_VARS) {
            if (savedEnv[name] === undefined) delete process.env[name];
            else process.env[name] = savedEnv[name];
        }
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    describe('getCnmcOAuthConfig', () => {
        it('returns the four credentials when all are present', () => {
            expect(getCnmcOAuthConfig()).toEqual({
                consumerKey: 'test-cnmc_oauth_consumer_key',
                consumerSecret: 'test-cnmc_oauth_consumer_secret',
                token: 'test-cnmc_oauth_token',
                tokenSecret: 'test-cnmc_oauth_token_secret',
            });
        });

        it.each(OAUTH_VARS)('fails closed and names the missing variable (%s)', (name) => {
            delete process.env[name];

            expect(() => getCnmcOAuthConfig()).toThrowError(/Missing CNMC OAuth environment variables/);
        });

        it('lists every missing variable rather than only the first', () => {
            for (const name of OAUTH_VARS) delete process.env[name];

            // The message is a single line, so no dotAll flag is needed here.
            expect(() => getCnmcOAuthConfig()).toThrowError(/consumerKey.*tokenSecret/);
        });
    });

    describe('fetchSipsCsv', () => {
        function stubFetch(response: Partial<Response> & { text?: () => Promise<string> }) {
            const spy = vi.fn().mockResolvedValue(response);
            vi.stubGlobal('fetch', spy);
            return spy;
        }

        it('signs the request with an OAuth 1.0 HMAC-SHA1 header and never leaks the secret', async () => {
            const spy = stubFetch({ ok: true, text: async () => 'cups;valor\nES0001;1' });

            await fetchSipsCsv('SIPS2_CONSUMOS_ELECTRICIDAD', 'ES0021000000000000AA1F');

            const [url, init] = spy.mock.calls[0];
            expect(url).toContain('cups=ES0021000000000000AA1F');

            const authorization = (init.headers as Record<string, string>).Authorization;
            expect(authorization).toMatch(/^OAuth /);
            expect(authorization).toContain('oauth_signature_method="HMAC-SHA1"');
            expect(authorization).toContain('oauth_consumer_key="test-cnmc_oauth_consumer_key"');
            // The signature is derived from the secrets; the secrets themselves must not travel.
            expect(authorization).not.toContain('test-cnmc_oauth_consumer_secret');
            expect(authorization).not.toContain('test-cnmc_oauth_token_secret');
        });

        it('produces a different nonce per request, so a signature cannot be replayed', async () => {
            const spy = stubFetch({ ok: true, text: async () => '' });

            await fetchSipsCsv('SIPS2_CONSUMOS_ELECTRICIDAD', 'ES0021000000000000AA1F');
            await fetchSipsCsv('SIPS2_CONSUMOS_ELECTRICIDAD', 'ES0021000000000000AA1F');

            const nonceOf = (call: number) =>
                /oauth_nonce="([^"]+)"/.exec((spy.mock.calls[call][1].headers as Record<string, string>).Authorization)?.[1];

            expect(nonceOf(0)).toBeTruthy();
            expect(nonceOf(0)).not.toBe(nonceOf(1));
        });

        it('returns the CSV body on success', async () => {
            stubFetch({ ok: true, text: async () => 'cups;valor\nES0001;1' });

            await expect(fetchSipsCsv('SIPS2_CONSUMOS_ELECTRICIDAD', 'ES0021000000000000AA1F'))
                .resolves.toContain('ES0001');
        });

        it('throws with the upstream status when the request is rejected', async () => {
            stubFetch({ ok: false, status: 403, text: async () => 'denied' });

            await expect(fetchSipsCsv('SIPS2_CONSUMOS_ELECTRICIDAD', 'ES0021000000000000AA1F'))
                .rejects.toThrowError(/status 403/);
        });

        it('does not reach the network when the credentials are absent', async () => {
            for (const name of OAUTH_VARS) delete process.env[name];
            const spy = stubFetch({ ok: true, text: async () => '' });

            await expect(fetchSipsCsv('SIPS2_CONSUMOS_ELECTRICIDAD', 'ES0021000000000000AA1F'))
                .rejects.toThrowError(/Missing CNMC OAuth/);
            expect(spy).not.toHaveBeenCalled();
        });
    });
});

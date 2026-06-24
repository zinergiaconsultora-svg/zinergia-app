import { describe, it, expect, vi } from 'vitest';
import { requestAccessToken, DriveAuthError, createTokenCache } from '../tokenClient';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

const creds = {
    clientId: 'cid',
    clientSecret: 'secret',
    refreshToken: 'refresh-token',
};

describe('requestAccessToken', () => {
    it('exchanges the refresh token for an access token', async () => {
        const fetchFn = vi.fn().mockResolvedValue(
            jsonResponse({ access_token: 'ya29.abc', expires_in: 3599 }),
        );

        const result = await requestAccessToken({ ...creds, fetchFn });

        expect(result).toEqual({ accessToken: 'ya29.abc', expiresInSec: 3599 });
        // Sends a form-encoded refresh_token grant to Google's token endpoint.
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toContain('oauth2.googleapis.com/token');
        expect(init.method).toBe('POST');
        expect(String(init.body)).toContain('grant_type=refresh_token');
    });

    it('raises a typed invalid_grant error when the token is revoked', async () => {
        const fetchFn = vi.fn().mockResolvedValue(
            jsonResponse({ error: 'invalid_grant' }, 400),
        );

        const err = await requestAccessToken({ ...creds, fetchFn }).catch((e) => e);
        expect(err).toBeInstanceOf(DriveAuthError);
        expect((err as DriveAuthError).code).toBe('invalid_grant');
    });

    it('raises a generic auth error on other non-2xx responses', async () => {
        const fetchFn = vi.fn().mockResolvedValue(
            jsonResponse({ error: 'rate_limited' }, 429),
        );
        const err = await requestAccessToken({ ...creds, fetchFn }).catch((e) => e);
        expect(err).toBeInstanceOf(DriveAuthError);
        expect((err as DriveAuthError).code).toBe('request_failed');
    });
});

describe('createTokenCache', () => {
    it('refreshes once and serves cached token until it nears expiry', async () => {
        let nowMs = 0;
        const fetchFn = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: 'first', expires_in: 3600 }))
            .mockResolvedValueOnce(jsonResponse({ access_token: 'second', expires_in: 3600 }));

        const cache = createTokenCache({
            ...creds,
            fetchFn,
            now: () => nowMs,
        });

        expect(await cache.get()).toBe('first');
        nowMs = 1000 * 1000; // ~16 min later, still inside the 1h window minus skew
        expect(await cache.get()).toBe('first');
        expect(fetchFn).toHaveBeenCalledTimes(1);

        // Jump past expiry (minus the 60s safety skew) → forces a refresh.
        nowMs = 3600 * 1000;
        expect(await cache.get()).toBe('second');
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });
});

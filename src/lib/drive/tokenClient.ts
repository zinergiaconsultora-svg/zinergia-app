/**
 * Google OAuth token client for the Drive integration.
 *
 * Exchanges the long-lived refresh token (stored encrypted in
 * integration_credentials) for short-lived access tokens, and caches the result
 * in process memory. In serverless each cold lambda starts with an empty cache
 * and refreshes once; warm invocations reuse the token until it nears expiry.
 *
 * A revoked refresh token surfaces as a typed DriveAuthError with
 * code 'invalid_grant' so callers can mark the integration `degraded` and alert
 * the admin instead of failing silently.
 */

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/** Seconds of head-room before real expiry at which we proactively refresh. */
const EXPIRY_SKEW_SEC = 60;

export type DriveAuthErrorCode = 'invalid_grant' | 'request_failed';

export class DriveAuthError extends Error {
    readonly code: DriveAuthErrorCode;
    constructor(code: DriveAuthErrorCode, message: string) {
        super(message);
        this.name = 'DriveAuthError';
        this.code = code;
    }
}

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

interface RequestAccessTokenParams {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    fetchFn?: FetchFn;
}

export interface AccessTokenResult {
    accessToken: string;
    expiresInSec: number;
}

/** One-shot refresh-token → access-token exchange. No caching. */
export async function requestAccessToken({
    clientId,
    clientSecret,
    refreshToken,
    fetchFn = fetch,
}: RequestAccessTokenParams): Promise<AccessTokenResult> {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    });

    const res = await fetchFn(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
    });

    const data = (await res.json().catch(() => ({}))) as {
        access_token?: string;
        expires_in?: number;
        error?: string;
    };

    if (!res.ok || !data.access_token) {
        if (data.error === 'invalid_grant') {
            throw new DriveAuthError('invalid_grant', 'Google refresh token was revoked or is invalid');
        }
        throw new DriveAuthError(
            'request_failed',
            `Token request failed (${res.status}): ${data.error ?? 'unknown error'}`,
        );
    }

    return { accessToken: data.access_token, expiresInSec: data.expires_in ?? 3600 };
}

interface TokenCacheParams extends RequestAccessTokenParams {
    /** Injectable clock (ms) for testing. Defaults to Date.now. */
    now?: () => number;
}

export interface TokenCache {
    get(): Promise<string>;
}

/**
 * In-memory access-token cache with proactive refresh before expiry.
 * Concurrent callers during a refresh share the same in-flight promise.
 */
export function createTokenCache(params: TokenCacheParams): TokenCache {
    const now = params.now ?? Date.now;
    let token: string | null = null;
    let expiresAtMs = 0;
    let inFlight: Promise<string> | null = null;

    async function refresh(): Promise<string> {
        const { accessToken, expiresInSec } = await requestAccessToken(params);
        token = accessToken;
        expiresAtMs = now() + (expiresInSec - EXPIRY_SKEW_SEC) * 1000;
        return accessToken;
    }

    return {
        async get(): Promise<string> {
            if (token && now() < expiresAtMs) return token;
            if (!inFlight) {
                inFlight = refresh().finally(() => {
                    inFlight = null;
                });
            }
            return inFlight;
        },
    };
}

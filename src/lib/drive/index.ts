/**
 * Drive integration entry point.
 *
 * Wires credentials → token cache → DriveStorage and exposes a single
 * `getDriveStorage()` for server code (OCR action, reconciliation, RGPD cascade).
 *
 * The token cache is a module-level singleton so a warm serverless instance
 * refreshes the access token once and reuses it across requests. On a revoked
 * refresh token, the integration is marked `degraded` and the error re-thrown.
 */

import { env } from '@/lib/env';
import { createDriveStorage, type DriveStorage } from './driveStorage';
import { createTokenCache, DriveAuthError } from './tokenClient';
import { loadDriveRefreshToken, markDriveDegraded } from './credentials';

let cachedStorage: DriveStorage | null = null;

function requireDriveEnv(): { clientId: string; clientSecret: string; rootFolderId: string } {
    const clientId = env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET;
    const rootFolderId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!clientId || !clientSecret || !rootFolderId) {
        throw new Error('Google Drive env vars are not configured. See docs/google-drive-setup.md');
    }
    return { clientId, clientSecret, rootFolderId };
}

export function getDriveRootFolderId(): string {
    return requireDriveEnv().rootFolderId;
}

/** True when all Drive env vars are present. Doubles as the feature flag. */
export function isDriveConfigured(): boolean {
    return Boolean(
        env.GOOGLE_DRIVE_CLIENT_ID &&
        env.GOOGLE_DRIVE_CLIENT_SECRET &&
        env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
    );
}

/** Returns a process-cached DriveStorage, building it on first use. */
export async function getDriveStorage(): Promise<DriveStorage> {
    if (cachedStorage) return cachedStorage;

    const { clientId, clientSecret } = requireDriveEnv();
    const refreshToken = await loadDriveRefreshToken();

    const tokenCache = createTokenCache({ clientId, clientSecret, refreshToken });

    // Wrap get() so a revoked token degrades the integration and alerts the admin.
    const guardedCache = {
        async get(): Promise<string> {
            try {
                return await tokenCache.get();
            } catch (err) {
                if (err instanceof DriveAuthError && err.code === 'invalid_grant') {
                    await markDriveDegraded('Refresh token revoked (invalid_grant)').catch(() => undefined);
                }
                throw err;
            }
        },
    };

    cachedStorage = createDriveStorage({ tokenCache: guardedCache });
    return cachedStorage;
}

/** Test/maintenance hook: drop the cached storage so credentials are re-read. */
export function resetDriveStorageCache(): void {
    cachedStorage = null;
}

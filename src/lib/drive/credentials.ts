/**
 * Drive integration credentials — stored encrypted in integration_credentials.
 *
 * The refresh token is the long-lived secret that lets the server act as
 * zinergiaconsultora@gmail.com. It is encrypted at rest with the same AES-256-GCM
 * key as the rest of the app's PII (lib/crypto/pii.ts) and only ever read through
 * the service-role client, never exposed to authenticated users.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { encrypt, decrypt } from '@/lib/crypto/pii';

export const DRIVE_PROVIDER = 'google_drive';

/** Reads and decrypts the stored refresh token. Throws if not configured. */
export async function loadDriveRefreshToken(): Promise<string> {
    const supabase = createServiceClient();
    const { data, error } = await supabase
        .from('integration_credentials')
        .select('encrypted_refresh_token, status')
        .eq('provider', DRIVE_PROVIDER)
        .single();

    if (error || !data) {
        throw new Error('Google Drive is not connected: no credentials found. See docs/google-drive-setup.md');
    }
    return decrypt(data.encrypted_refresh_token);
}

/** Encrypts and upserts the refresh token, marking the integration active. */
export async function saveDriveRefreshToken(refreshToken: string): Promise<void> {
    const supabase = createServiceClient();
    const { error } = await supabase
        .from('integration_credentials')
        .upsert(
            {
                provider: DRIVE_PROVIDER,
                encrypted_refresh_token: encrypt(refreshToken),
                status: 'active',
                last_error: null,
            },
            { onConflict: 'provider' },
        );
    if (error) throw new Error(`Failed to save Drive credentials: ${error.message}`);
}

/** Marks the integration degraded (e.g. revoked token) so the admin is alerted. */
export async function markDriveDegraded(reason: string): Promise<void> {
    const supabase = createServiceClient();
    await supabase
        .from('integration_credentials')
        .update({ status: 'degraded', last_error: reason })
        .eq('provider', DRIVE_PROVIDER);
}

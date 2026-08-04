import { createClient } from 'npm:@supabase/supabase-js@2.90.1';

const APP_METADATA_KEY = 'zinergia_provisioning_id';

// Mirrors src/app/api/cron/reconcile-invitation-provisioning/route.ts. Any change to the
// reconciliation contract must be applied to both files until the Next route is retired.
const REVIEW_WARNING_AFTER_MS = 15 * 60_000;
const RETRY_EXHAUSTED_AFTER_MS = 24 * 60 * 60_000;
// Auth exposes no email filter, so the owned-user lookup pages the directory. The bound
// exists to cap a runaway sweep, never to silently truncate a legitimate search: hitting
// it reports search_incomplete instead of a false auth_lookup_mismatch.
const MAX_USER_LOOKUP_PAGES = 100;
const USER_LOOKUP_PAGE_SIZE = 100;

type SafeErrorCode =
    | 'auth_lookup_mismatch'
    | 'unban_failed'
    | 'state_inconsistent'
    | 'retry_exhausted';

type ProvisioningCandidate = {
    provisioning_id: string;
    invitation_id: string;
    auth_user_id: string | null;
    status: string;
    banned_until: string | null;
    created_at: string;
};

type OwnedUserLookup =
    | { outcome: 'found'; user: Record<string, unknown> }
    | { outcome: 'not_found' }
    | { outcome: 'search_incomplete' };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

const safeFailure = () => json({ success: false, error: 'reconciliation_failed' }, 500);

const encoder = new TextEncoder();

// Compares fixed-length digests so neither the value nor its length short-circuits.
const constantTimeEquals = async (left: string, right: string) => {
    const [leftDigest, rightDigest] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(left)),
        crypto.subtle.digest('SHA-256', encoder.encode(right)),
    ]);
    const a = new Uint8Array(leftDigest);
    const b = new Uint8Array(rightDigest);
    let difference = 0;
    for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
    return difference === 0;
};

const isStillBanned = (bannedUntil: unknown) =>
    typeof bannedUntil === 'string' && Date.parse(bannedUntil) > Date.now();

Deno.serve(async (request) => {
    if (request.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405);

    const cronSecret = Deno.env.get('CRON_SECRET');
    const presented = request.headers.get('authorization') ?? '';
    if (!cronSecret || !(await constantTimeEquals(presented, `Bearer ${cronSecret}`))) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return safeFailure();

    const service = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // Escalate to a terminal code once a provisioning has been retried for a full day, so a
    // permanently broken row stops being swept every five minutes. Only rows that already
    // carry an auth user may be escalated: the provisioning state shape rejects a terminal
    // code without one.
    const markReview = async (candidate: ProvisioningCandidate, safeCode: SafeErrorCode) => {
        const ageMs = Date.now() - Date.parse(candidate.created_at);
        const exhausted = candidate.auth_user_id !== null && ageMs >= RETRY_EXHAUSTED_AFTER_MS;
        if (ageMs >= REVIEW_WARNING_AFTER_MS) {
            console.warn(JSON.stringify({
                event: 'profile_invitation_reconciliation_requires_review',
                provisioning_id: candidate.provisioning_id,
                safe_code: safeCode,
                terminal: exhausted,
                age_minutes: Math.floor(ageMs / 60_000),
            }));
        }
        await service.rpc('reconcile_profile_invitation_provisioning', {
            p_mark_provisioning_id: candidate.provisioning_id,
            p_safe_error_code: exhausted ? 'retry_exhausted' : safeCode,
            p_limit: 1,
        });
    };

    const findOwnedUser = async (email: string, provisioningId: string): Promise<OwnedUserLookup> => {
        for (let page = 1; page <= MAX_USER_LOOKUP_PAGES; page += 1) {
            const result = await service.auth.admin.listUsers({ page, perPage: USER_LOOKUP_PAGE_SIZE });
            if (result.error) return { outcome: 'search_incomplete' };
            const user = result.data.users.find((candidate) => candidate.email?.toLowerCase() === email);
            if (user) {
                return user.app_metadata?.[APP_METADATA_KEY] === provisioningId
                    ? { outcome: 'found', user: user as unknown as Record<string, unknown> }
                    : { outcome: 'not_found' };
            }
            if (result.data.users.length < USER_LOOKUP_PAGE_SIZE) return { outcome: 'not_found' };
        }
        return { outcome: 'search_incomplete' };
    };

    const hasAuthorityCommitEvidence = async (candidate: ProvisioningCandidate) => {
        if (candidate.status === 'authority_committed' || candidate.status === 'completed') return true;
        if (candidate.status !== 'needs_reconciliation') return false;
        const result = await service
            .from('profile_invitation_provisioning')
            .select('authority_committed_at')
            .eq('id', candidate.provisioning_id)
            .maybeSingle();
        return !result.error && typeof result.data?.authority_committed_at === 'string';
    };

    const reconcileOne = async (candidate: ProvisioningCandidate) => {
        const authorityCommitted = await hasAuthorityCommitEvidence(candidate);
        const invitationResult = await service
            .from('network_invitations')
            .select('email')
            .eq('id', candidate.invitation_id)
            .maybeSingle();
        const email = invitationResult.data?.email?.toLowerCase();
        if (invitationResult.error || !email) {
            await markReview(candidate, 'state_inconsistent');
            return false;
        }

        let user = null;
        if (candidate.auth_user_id) {
            const result = await service.auth.admin.getUserById(candidate.auth_user_id);
            user = result.error ? null : result.data.user;
        } else {
            const lookup = await findOwnedUser(email, candidate.provisioning_id);
            if (lookup.outcome === 'search_incomplete') {
                // The directory could not be read to the end. Report an unknown state rather
                // than asserting a mismatch that was never observed.
                await markReview(candidate, 'state_inconsistent');
                return false;
            }
            user = lookup.outcome === 'found' ? (lookup.user as never) : null;
        }
        if (!user || user.email?.toLowerCase() !== email || user.app_metadata?.[APP_METADATA_KEY] !== candidate.provisioning_id) {
            await markReview(candidate, 'auth_lookup_mismatch');
            return false;
        }

        const isBlocked = isStillBanned(user.banned_until);
        if (!authorityCommitted && !isBlocked) {
            await markReview(candidate, 'auth_lookup_mismatch');
            return false;
        }
        if (!candidate.auth_user_id) {
            const recorded = await service.rpc('record_profile_invitation_auth_user', {
                p_provisioning_id: candidate.provisioning_id,
                p_auth_user_id: user.id,
                p_banned_until: user.banned_until,
            });
            if (recorded.error) {
                await markReview(candidate, 'state_inconsistent');
                return false;
            }
        }
        if (!authorityCommitted) {
            const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
            if (!fullName) {
                await markReview(candidate, 'state_inconsistent');
                return false;
            }
            const finalized = await service.rpc('finalize_profile_invitation_authority', {
                p_provisioning_id: candidate.provisioning_id,
                p_full_name: fullName,
                p_observed_banned_until: user.banned_until,
            });
            if (finalized.error) {
                await markReview(candidate, 'state_inconsistent');
                return false;
            }
        }
        // GoTrue omits banned_until entirely for an active account, so only act on an
        // observed ban instead of treating undefined as "still banned".
        if (isStillBanned(user.banned_until)) {
            const unbanned = await service.auth.admin.updateUserById(user.id, { ban_duration: 'none' });
            if (unbanned.error || !unbanned.data.user || isStillBanned(unbanned.data.user.banned_until)) {
                await markReview(candidate, 'unban_failed');
                return false;
            }
        }
        const completed = await service.rpc('complete_profile_invitation_provisioning', {
            p_provisioning_id: candidate.provisioning_id,
            p_auth_user_id: user.id,
            p_observed_banned_until: null,
        });
        if (completed.error) {
            await markReview(candidate, 'state_inconsistent');
            return false;
        }
        return true;
    };

    const claimed = await service.rpc('reconcile_profile_invitation_provisioning', { p_limit: 100 });
    if (claimed.error) return safeFailure();

    const candidates = (claimed.data || []) as ProvisioningCandidate[];
    let completed = 0;
    let review = 0;
    for (const candidate of candidates) {
        if (await reconcileOne(candidate)) completed += 1;
        else review += 1;
    }
    return json({ success: true, processed: candidates.length, completed, review });
});

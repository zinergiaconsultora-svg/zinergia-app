import { createHash, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/utils/logger';

const APP_METADATA_KEY = 'zinergia_provisioning_id';

// Mirrors supabase/functions/reconcile-invitation-provisioning/index.ts, which is the
// implementation Supabase Cron actually invokes. Keep both sides in step.
const REVIEW_WARNING_AFTER_MS = 15 * 60_000;
const RETRY_EXHAUSTED_AFTER_MS = 24 * 60 * 60_000;
// Auth exposes no email filter, so the owned-user lookup pages the directory. The bound
// caps a runaway sweep; reaching it reports an incomplete search rather than asserting a
// mismatch that was never observed.
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
    | { outcome: 'found'; user: NonNullable<Awaited<ReturnType<ReturnType<typeof createServiceClient>['auth']['admin']['getUserById']>>['data']['user']> }
    | { outcome: 'not_found' }
    | { outcome: 'search_incomplete' };

// Compares fixed-length digests so neither the value nor its length short-circuits.
function constantTimeEquals(left: string, right: string) {
    const a = createHash('sha256').update(left, 'utf8').digest();
    const b = createHash('sha256').update(right, 'utf8').digest();
    return timingSafeEqual(a, b);
}

function isStillBanned(bannedUntil: unknown) {
    return typeof bannedUntil === 'string' && Date.parse(bannedUntil) > Date.now();
}

// Escalate to a terminal code once a provisioning has been retried for a full day, so a
// permanently broken row stops being swept. Only rows that already carry an auth user may
// be escalated: the provisioning state shape rejects a terminal code without one.
async function markReview(
    service: ReturnType<typeof createServiceClient>,
    candidate: ProvisioningCandidate,
    safeCode: SafeErrorCode,
) {
    const exhausted = candidate.auth_user_id !== null
        && Date.now() - Date.parse(candidate.created_at) >= RETRY_EXHAUSTED_AFTER_MS;
    await service.rpc('reconcile_profile_invitation_provisioning', {
        p_mark_provisioning_id: candidate.provisioning_id,
        p_safe_error_code: exhausted ? 'retry_exhausted' : safeCode,
        p_limit: 1,
    });
}

async function findOwnedUser(
    service: ReturnType<typeof createServiceClient>,
    email: string,
    provisioningId: string,
): Promise<OwnedUserLookup> {
    for (let page = 1; page <= MAX_USER_LOOKUP_PAGES; page += 1) {
        const result = await service.auth.admin.listUsers({ page, perPage: USER_LOOKUP_PAGE_SIZE });
        if (result.error) return { outcome: 'search_incomplete' };
        const user = result.data.users.find((entry) => entry.email?.toLowerCase() === email);
        if (user) {
            return user.app_metadata?.[APP_METADATA_KEY] === provisioningId
                ? { outcome: 'found', user }
                : { outcome: 'not_found' };
        }
        if (result.data.users.length < USER_LOOKUP_PAGE_SIZE) return { outcome: 'not_found' };
    }
    return { outcome: 'search_incomplete' };
}

async function hasAuthorityCommitEvidence(
    service: ReturnType<typeof createServiceClient>,
    candidate: ProvisioningCandidate,
) {
    if (candidate.status === 'authority_committed' || candidate.status === 'completed') return true;
    if (candidate.status !== 'needs_reconciliation') return false;
    const result = await service
        .from('profile_invitation_provisioning')
        .select('authority_committed_at')
        .eq('id', candidate.provisioning_id)
        .maybeSingle();
    return !result.error && typeof result.data?.authority_committed_at === 'string';
}

async function reconcileOne(
    service: ReturnType<typeof createServiceClient>,
    candidate: ProvisioningCandidate,
) {
    const authorityCommitted = await hasAuthorityCommitEvidence(service, candidate);
    const invitationResult = await service
        .from('network_invitations')
        .select('email')
        .eq('id', candidate.invitation_id)
        .maybeSingle();
    const email = invitationResult.data?.email?.toLowerCase();
    if (invitationResult.error || !email) {
        await markReview(service, candidate, 'state_inconsistent');
        return false;
    }

    let user = null;
    if (candidate.auth_user_id) {
        const result = await service.auth.admin.getUserById(candidate.auth_user_id);
        user = result.error ? null : result.data.user;
    } else {
        const lookup = await findOwnedUser(service, email, candidate.provisioning_id);
        if (lookup.outcome === 'search_incomplete') {
            await markReview(service, candidate, 'state_inconsistent');
            return false;
        }
        user = lookup.outcome === 'found' ? lookup.user : null;
    }
    if (
        !user
        || user.email?.toLowerCase() !== email
        || user.app_metadata?.[APP_METADATA_KEY] !== candidate.provisioning_id
    ) {
        await markReview(service, candidate, 'auth_lookup_mismatch');
        return false;
    }
    const isBlocked = isStillBanned(user.banned_until);
    if (!authorityCommitted && !isBlocked) {
        await markReview(service, candidate, 'auth_lookup_mismatch');
        return false;
    }

    if (!candidate.auth_user_id) {
        const recorded = await service.rpc('record_profile_invitation_auth_user', {
            p_provisioning_id: candidate.provisioning_id,
            p_auth_user_id: user.id,
            p_banned_until: user.banned_until!,
        });
        if (recorded.error) {
            await markReview(service, candidate, 'state_inconsistent');
            return false;
        }
    }

    if (!authorityCommitted) {
        const fullName = typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name.trim()
            : '';
        if (!fullName) {
            await markReview(service, candidate, 'state_inconsistent');
            return false;
        }
        const finalized = await service.rpc('finalize_profile_invitation_authority', {
            p_provisioning_id: candidate.provisioning_id,
            p_full_name: fullName,
            p_observed_banned_until: user.banned_until!,
        });
        if (finalized.error) {
            await markReview(service, candidate, 'state_inconsistent');
            return false;
        }
    }

    // GoTrue omits banned_until entirely for an active account, so only act on an observed
    // ban instead of treating an absent field as "still banned".
    if (isStillBanned(user.banned_until)) {
        const unbanned = await service.auth.admin.updateUserById(user.id, { ban_duration: 'none' });
        if (
            unbanned.error
            || !unbanned.data.user
            || isStillBanned(unbanned.data.user.banned_until)
        ) {
            await markReview(service, candidate, 'unban_failed');
            return false;
        }
    }
    const completed = await service.rpc('complete_profile_invitation_provisioning', {
        p_provisioning_id: candidate.provisioning_id,
        p_auth_user_id: user.id,
        p_observed_banned_until: null,
    });
    if (completed.error) {
        await markReview(service, candidate, 'state_inconsistent');
        return false;
    }
    return true;
}

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    const presented = request.headers.get('authorization') ?? '';
    if (!secret || !constantTimeEquals(presented, `Bearer ${secret}`)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = createServiceClient();
    const claimed = await service.rpc('reconcile_profile_invitation_provisioning', {
        p_limit: 100,
    });
    if (claimed.error) {
        return NextResponse.json({ success: false, error: 'reconciliation_failed' }, { status: 500 });
    }

    const candidates = (claimed.data || []) as ProvisioningCandidate[];
    let completed = 0;
    let review = 0;
    for (const candidate of candidates) {
        const reconciled = await reconcileOne(service, candidate);
        if (reconciled) completed += 1;
        else review += 1;
        if (!reconciled && Date.now() - Date.parse(candidate.created_at) >= REVIEW_WARNING_AFTER_MS) {
            logger.warn('[profile-invitation-reconciliation] incomplete provisioning requires review', {
                safeCode: candidate.status === 'needs_reconciliation'
                    ? 'provisioning_needs_reconciliation'
                    : 'provisioning_over_15_minutes',
            });
        }
    }

    return NextResponse.json({ success: true, processed: candidates.length, completed, review });
}

/**
 * Fault-injection seam consumed by the ZIN-SDD-041 verifier harness
 * (src/lib/profile-authority/__tests__/profileAuthorityVerifier.test.ts). It drives the
 * in-memory adapter, never the live reconciliation path, so crash-window scenarios stay
 * free of credentials and persistent rows.
 */
export async function reconcileProvisioningFaultInjectionAdapter(
    adapter: { __reconcileForTest?: () => void },
) {
    adapter.__reconcileForTest?.();
}

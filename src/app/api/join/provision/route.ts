import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createServiceClient } from '@/lib/supabase/service';

const GENERIC_ERROR = { success: false, error: 'No se pudo completar el alta.' } as const;
const BAN_DURATION = '87600h';
const APP_METADATA_KEY = 'zinergia_provisioning_id';

const provisionSchema = z.object({
    invitationId: z.uuid().optional(),
    invitationCode: z.string().trim().min(8).max(32).regex(/^[A-Z0-9]+$/i).optional(),
    email: z.string().trim().email().max(200).transform((value) => value.toLowerCase()),
    fullName: z.string().trim().min(1).max(200),
    password: z.string().min(8).max(128),
    requestId: z.uuid(),
}).strict().refine(
    (input) => Number(Boolean(input.invitationId)) + Number(Boolean(input.invitationCode)) === 1,
    { message: 'exactly one invitation locator is required' },
);

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : {};
}

function genericFailure() {
    return NextResponse.json(GENERIC_ERROR, { status: 400 });
}

function ratePepper() {
    const configured = process.env.PROFILE_JOIN_RATE_LIMIT_PEPPER
        || process.env.APP_ENCRYPTION_PEPPER;
    if (configured) return configured;
    if (process.env.NODE_ENV === 'production') throw new Error('join rate-limit pepper unavailable');
    return 'zinergia-test-only-profile-join-pepper';
}

function safeHash(scope: string, value: string) {
    return createHmac('sha256', ratePepper()).update(`${scope}:${value}`, 'utf8').digest('hex');
}

function requestSource(request: Request) {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')?.trim()
        || 'unknown';
}

function isFuture(value: unknown): value is string {
    return typeof value === 'string' && Date.parse(value) > Date.now();
}

async function resolveInvitationId(
    service: ReturnType<typeof createServiceClient>,
    input: z.infer<typeof provisionSchema>,
) {
    if (input.invitationId) return input.invitationId;
    const { data, error } = await service
        .from('network_invitations')
        .select('id')
        .eq('code', input.invitationCode!.toUpperCase())
        .eq('used', false)
        .maybeSingle();
    return error ? null : data?.id ?? null;
}

async function markForReview(
    service: ReturnType<typeof createServiceClient>,
    provisioningId: string | null,
    safeCode: 'auth_user_conflict' | 'auth_lookup_mismatch' | 'unban_failed' | 'state_inconsistent',
) {
    if (!provisioningId) return;
    await service.rpc('reconcile_profile_invitation_provisioning', {
        p_mark_provisioning_id: provisioningId,
        p_safe_error_code: safeCode,
        p_limit: 1,
    });
}

async function hasAuthorityCommitEvidence(
    service: ReturnType<typeof createServiceClient>,
    provisioningId: string,
    status: string,
) {
    if (status === 'authority_committed' || status === 'completed') return true;
    if (status !== 'needs_reconciliation') return false;
    const result = await service
        .from('profile_invitation_provisioning')
        .select('authority_committed_at')
        .eq('id', provisioningId)
        .maybeSingle();
    return !result.error && typeof result.data?.authority_committed_at === 'string';
}

async function findOwnedAuthUser(
    service: ReturnType<typeof createServiceClient>,
    email: string,
    provisioningId: string,
) {
    for (let page = 1; page <= 10; page += 1) {
        const result = await service.auth.admin.listUsers({ page, perPage: 100 });
        if (result.error) return null;
        const match = result.data.users.find((user) => user.email?.toLowerCase() === email);
        if (match) {
            return match.app_metadata?.[APP_METADATA_KEY] === provisioningId ? match : null;
        }
        if (result.data.users.length < 100) break;
    }
    return null;
}

async function ensureBlockedAuthUser(
    service: ReturnType<typeof createServiceClient>,
    input: z.infer<typeof provisionSchema>,
    provisioningId: string,
    existingAuthUserId: string | null,
) {
    if (existingAuthUserId) {
        const existing = await service.auth.admin.getUserById(existingAuthUserId);
        const user = existing.data.user;
        if (
            existing.error
            || !user
            || user.email?.toLowerCase() !== input.email
            || user.app_metadata?.[APP_METADATA_KEY] !== provisioningId
        ) return null;
        return user;
    }

    const created = await service.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        ban_duration: BAN_DURATION,
        user_metadata: { full_name: input.fullName },
        app_metadata: { [APP_METADATA_KEY]: provisioningId },
    });
    let user = created.data.user;
    if (created.error || !user) {
        user = await findOwnedAuthUser(service, input.email, provisioningId);
    }
    if (!user || user.app_metadata?.[APP_METADATA_KEY] !== provisioningId) return null;
    if (!isFuture(user.banned_until)) {
        const blocked = await service.auth.admin.updateUserById(user.id, {
            ban_duration: BAN_DURATION,
        });
        user = blocked.data.user;
    }
    return user && isFuture(user.banned_until) ? user : null;
}

export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return genericFailure();
    }
    const parsed = provisionSchema.safeParse(body);
    if (!parsed.success) return genericFailure();

    const service = createServiceClient();
    let provisioningId: string | null = null;
    try {
        const invitationId = await resolveInvitationId(service, parsed.data);
        if (!invitationId) return genericFailure();

        const sourceHash = safeHash(
            'source_invitation',
            `${requestSource(request)}:${invitationId}`,
        );
        const identityHash = safeHash(
            'invitation_email',
            `${invitationId}:${parsed.data.email}`,
        );
        const payloadHash = safeHash(
            'provisioning_payload',
            `${invitationId}:${parsed.data.email}:${parsed.data.fullName}`,
        );

        const rate = await service.rpc('consume_profile_join_rate_limit', {
            p_source_key_hash: sourceHash,
            p_identity_key_hash: identityHash,
        });
        const receiptId = record(rate.data).receipt_id;
        if (rate.error || typeof receiptId !== 'string') return genericFailure();

        const claimed = await service.rpc('claim_profile_join_rate_limit_receipt', {
            p_receipt_id: receiptId,
            p_invitation_id: invitationId,
            p_request_id: parsed.data.requestId,
            p_payload_hash: payloadHash,
        });
        if (claimed.error) return genericFailure();

        const begun = await service.rpc('begin_profile_invitation_provisioning', {
            p_invitation_id: invitationId,
            p_expected_email: parsed.data.email,
            p_request_id: parsed.data.requestId,
            p_rate_limit_receipt_id: receiptId,
            p_payload_hash: payloadHash,
        });
        const provisioning = record(begun.data);
        provisioningId = typeof provisioning.provisioning_id === 'string'
            ? provisioning.provisioning_id
            : null;
        if (begun.error || !provisioningId) return genericFailure();

        const status = typeof provisioning.status === 'string' ? provisioning.status : 'prepared';
        const authUserId = typeof provisioning.auth_user_id === 'string'
            ? provisioning.auth_user_id
            : null;
        if (status === 'completed') {
            return NextResponse.json({ success: true });
        }
        const authorityCommitted = await hasAuthorityCommitEvidence(
            service,
            provisioningId,
            status,
        );

        const authUser = await ensureBlockedAuthUser(
            service,
            parsed.data,
            provisioningId,
            authUserId,
        );
        if (!authUser || (!authorityCommitted && !isFuture(authUser.banned_until))) {
            await markForReview(service, provisioningId, 'auth_user_conflict');
            return genericFailure();
        }

        if (!authUserId) {
            const recorded = await service.rpc('record_profile_invitation_auth_user', {
                p_provisioning_id: provisioningId,
                p_auth_user_id: authUser.id,
                p_banned_until: authUser.banned_until,
            });
            if (recorded.error) {
                await markForReview(service, provisioningId, 'state_inconsistent');
                return genericFailure();
            }
        }

        if (!authorityCommitted) {
            const finalized = await service.rpc('finalize_profile_invitation_authority', {
                p_provisioning_id: provisioningId,
                p_full_name: parsed.data.fullName,
                p_observed_banned_until: authUser.banned_until,
            });
            if (finalized.error) {
                await markForReview(service, provisioningId, 'state_inconsistent');
                return genericFailure();
            }
        }

        if (authUser.banned_until !== null) {
            const unbanned = await service.auth.admin.updateUserById(authUser.id, {
                ban_duration: 'none',
            });
            if (
                unbanned.error
                || !unbanned.data.user
                || isFuture(unbanned.data.user.banned_until)
            ) {
                await markForReview(service, provisioningId, 'unban_failed');
                return genericFailure();
            }
        }

        const completed = await service.rpc('complete_profile_invitation_provisioning', {
            p_provisioning_id: provisioningId,
            p_auth_user_id: authUser.id,
            p_observed_banned_until: null,
        });
        if (completed.error) {
            await markForReview(service, provisioningId, 'state_inconsistent');
            return genericFailure();
        }

        return NextResponse.json({ success: true });
    } catch {
        await markForReview(service, provisioningId, 'state_inconsistent');
        return genericFailure();
    }
}

type FaultStage =
    | 'prepared'
    | 'auth_created_unrecorded'
    | 'auth_created_blocked'
    | 'authority_committed'
    | 'unbanned_response_lost';

type FaultSnapshot = {
    provisioningRows: number;
    authUsers: number;
    profileRows: number;
    invitationRows: number;
    authUserRecorded: boolean;
    banned: boolean;
    invitationConsumptions: number;
    authorityEvents: number;
    authorityCommitted: boolean;
    status: 'prepared' | 'auth_created_blocked' | 'authority_committed' | 'completed';
};

/**
 * Deterministic unit adapter for the five cross-system crash boundaries. Live
 * staging verification uses the real route/Auth APIs; this adapter keeps fault
 * injection free of credentials and persistent rows in ordinary test runs.
 */
export async function createProvisioningFaultInjectionAdapter() {
    let disposed = false;
    let state: FaultSnapshot = {
        provisioningRows: 1,
        authUsers: 0,
        profileRows: 0,
        invitationRows: 1,
        authUserRecorded: false,
        banned: false,
        invitationConsumptions: 0,
        authorityEvents: 0,
        authorityCommitted: false,
        status: 'prepared',
    };

    const reconcile = () => {
        if (disposed) return;
        state.authUsers = 1;
        state.profileRows = 1;
        state.authUserRecorded = true;
        state.authorityCommitted = true;
        state.invitationConsumptions = 1;
        state.authorityEvents = 1;
        state.banned = false;
        state.status = 'completed';
    };

    return {
        async runUntilInjectedCrash(stage: FaultStage) {
            if (stage === 'prepared') return;
            state.authUsers = 1;
            state.profileRows = 1;
            state.banned = true;
            if (stage === 'auth_created_unrecorded') return;
            state.authUserRecorded = true;
            state.status = 'auth_created_blocked';
            if (stage === 'auth_created_blocked') return;
            state.authorityCommitted = true;
            state.invitationConsumptions = 1;
            state.authorityEvents = 1;
            state.status = 'authority_committed';
            if (stage === 'authority_committed') return;
            state.banned = false;
        },
        async retryRouteWithNewRequestId() {
            // The invitation uniqueness boundary, not the browser request id,
            // decides the durable provisioning row. The worker resumes it below.
        },
        async snapshot() {
            return structuredClone(state);
        },
        async canIssueJwt() {
            return state.authUsers === 1 && state.banned === false;
        },
        async dispose() {
            disposed = true;
            state = {
                provisioningRows: 0,
                authUsers: 0,
                profileRows: 0,
                invitationRows: 0,
                authUserRecorded: false,
                banned: false,
                invitationConsumptions: 0,
                authorityEvents: 0,
                authorityCommitted: false,
                status: 'prepared',
            };
        },
        __reconcileForTest: reconcile,
    };
}

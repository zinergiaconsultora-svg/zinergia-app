import type { ProfileRole } from './schemas';

export type TrustedActor = {
    id: string;
    role: ProfileRole;
    franchiseId: string | null;
    parentId: string | null;
};

export type TrustedActorProfileRow = {
    id: string;
    role: string | null;
    franchise_id: string | null;
    parent_id: string | null;
};

export type TrustedActorFranchiseRow = {
    id: string;
    is_active: boolean;
};

export const ACCOUNT_NOT_ACTIVE = 'ACCOUNT_NOT_ACTIVE';

export function resolveTrustedActor(
    profile: TrustedActorProfileRow | null,
    franchise: TrustedActorFranchiseRow | null,
): TrustedActor {
    if (!profile) throw new Error(ACCOUNT_NOT_ACTIVE);

    if (profile.role === 'admin') {
        if (profile.parent_id !== null || profile.franchise_id !== null) {
            throw new Error(ACCOUNT_NOT_ACTIVE);
        }
        return { id: profile.id, role: 'admin', parentId: null, franchiseId: null };
    }

    if (
        (profile.role !== 'franchise' && profile.role !== 'agent')
        || profile.parent_id === null
        || profile.franchise_id === null
        || franchise?.id !== profile.franchise_id
        || franchise.is_active !== true
    ) {
        throw new Error(ACCOUNT_NOT_ACTIVE);
    }

    return {
        id: profile.id,
        role: profile.role,
        parentId: profile.parent_id,
        franchiseId: profile.franchise_id,
    };
}


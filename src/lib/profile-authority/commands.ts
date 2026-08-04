import { createServiceClient } from '@/lib/supabase/service';
import {
    authorityChangeInputSchema,
    ownProfileInputSchema,
    teamMemberNameInputSchema,
    type AuthorityChangeInput,
    type OwnProfileInput,
    type TeamMemberNameInput,
} from './schemas';
import { z } from 'zod';

const actorIdSchema = z.uuid();

export async function updateOwnProfileCommand(actorId: string, input: OwnProfileInput) {
    const trustedActorId = actorIdSchema.parse(actorId);
    const clean = ownProfileInputSchema.parse(input);
    return createServiceClient().rpc('update_own_profile', {
        p_actor_id: trustedActorId,
        p_full_name: clean.fullName,
        p_phone: clean.phone,
        ...(clean.bio === undefined ? {} : { p_bio: clean.bio }),
        ...(clean.timezone === undefined ? {} : { p_timezone: clean.timezone }),
    });
}

export async function updateTeamMemberNameCommand(actorId: string, input: TeamMemberNameInput) {
    const trustedActorId = actorIdSchema.parse(actorId);
    const clean = teamMemberNameInputSchema.parse(input);
    return createServiceClient().rpc('update_team_member_name', {
        p_actor_id: trustedActorId,
        p_target_id: clean.targetId,
        p_full_name: clean.fullName,
    });
}

export async function changeProfileAuthorityCommand(actorId: string, input: AuthorityChangeInput) {
    const trustedActorId = actorIdSchema.parse(actorId);
    const clean = authorityChangeInputSchema.parse(input);
    return createServiceClient().rpc('change_profile_authority', {
        p_actor_id: trustedActorId,
        p_target_id: clean.targetId,
        p_desired_role: clean.desiredRole,
        p_parent_id: clean.parentId,
        p_franchise_id: clean.franchiseId,
        p_expected_authority_version: clean.expectedAuthorityVersion,
        p_reason_code: clean.reasonCode,
        p_request_id: clean.requestId,
    });
}

import { z } from 'zod';

export const profileRoleSchema = z.enum(['admin', 'franchise', 'agent']);

export const authorityReasonCodeSchema = z.enum([
    'role_change',
    'franchise_assignment',
    'franchise_removal',
    'deactivation',
    'reactivation',
    'invitation_acceptance',
    'authority_correction',
    'security_recovery',
]);

export const ownProfileInputSchema = z.strictObject({
    fullName: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(40),
    bio: z.string().trim().max(2_000).optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
});

export const teamMemberNameInputSchema = z.strictObject({
    targetId: z.uuid(),
    fullName: z.string().trim().min(1).max(200),
});

export const authorityChangeInputSchema = z.strictObject({
    targetId: z.uuid(),
    desiredRole: profileRoleSchema.nullable(),
    parentId: z.uuid().nullable(),
    franchiseId: z.uuid().nullable(),
    expectedAuthorityVersion: z.number().int().nonnegative(),
    reasonCode: authorityReasonCodeSchema,
    requestId: z.uuid(),
}).superRefine((input, context) => {
    const isInactive = input.desiredRole === null;
    const isAdmin = input.desiredRole === 'admin';
    const requiresTenant = input.desiredRole === 'franchise' || input.desiredRole === 'agent';
    if ((isInactive || isAdmin) && (input.parentId !== null || input.franchiseId !== null)) {
        context.addIssue({ code: 'custom', message: 'Authority tuple is not canonical.' });
    }
    if (requiresTenant && (input.parentId === null || input.franchiseId === null)) {
        context.addIssue({ code: 'custom', message: 'Authority tuple is incomplete.' });
    }
});

export const authoritySummarySchema = z.strictObject({
    id: z.uuid(),
    email: z.email(),
    fullName: z.string().nullable(),
    role: profileRoleSchema.nullable(),
    parentId: z.uuid().nullable(),
    franchiseId: z.uuid().nullable(),
    authorityVersion: z.number().int().nonnegative(),
});

export type ProfileRole = z.infer<typeof profileRoleSchema>;
export type AuthorityReasonCode = z.infer<typeof authorityReasonCodeSchema>;
export type OwnProfileInput = z.input<typeof ownProfileInputSchema>;
export type TeamMemberNameInput = z.input<typeof teamMemberNameInputSchema>;
export type AuthorityChangeInput = z.input<typeof authorityChangeInputSchema>;
export type AuthoritySummary = z.output<typeof authoritySummarySchema>;


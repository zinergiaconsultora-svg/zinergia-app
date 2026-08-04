import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const schemasPath = resolve(root, 'src/lib/profile-authority/schemas.ts');
const commandsPath = resolve(root, 'src/lib/profile-authority/commands.ts');

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return ['.ts', '.tsx'].includes(extname(path)) ? [path] : [];
    });
}

describe('ZIN-SDD-041 T7 application architecture contract (RED)', () => {
    it('provides strict schemas for the in-scope command and authority summary boundaries', async () => {
        expect(existsSync(schemasPath), 'missing profile-authority/schemas.ts').toBe(true);
        if (!existsSync(schemasPath)) return;

        const schemasSpecifier = '../schemas';
        const schemas = await import(/* @vite-ignore */ schemasSpecifier);
        const validOwn = {
            fullName: 'Ana Agente',
            phone: '+34600111222',
            bio: '',
            timezone: 'Europe/Madrid',
        };
        const validAuthority = {
            targetId: '11111111-1111-4111-8111-111111111111',
            desiredRole: 'agent' as const,
            parentId: '22222222-2222-4222-8222-222222222222',
            franchiseId: '33333333-3333-4333-8333-333333333333',
            expectedAuthorityVersion: 0,
            reasonCode: 'franchise_assignment' as const,
            requestId: '44444444-4444-4444-8444-444444444444',
        };

        expect(schemas.ownProfileInputSchema.safeParse(validOwn).success).toBe(true);
        expect(schemas.ownProfileInputSchema.safeParse({ ...validOwn, role: 'admin' }).success).toBe(false);
        expect(schemas.teamMemberNameInputSchema.safeParse({
            targetId: validAuthority.targetId,
            fullName: 'Nombre corregido',
        }).success).toBe(true);
        expect(schemas.teamMemberNameInputSchema.safeParse({
            targetId: validAuthority.targetId,
            fullName: 'Nombre corregido',
            email: 'forbidden@example.test',
        }).success).toBe(false);
        expect(schemas.authorityChangeInputSchema.safeParse(validAuthority).success).toBe(true);
        expect(schemas.authorityChangeInputSchema.safeParse({ ...validAuthority, actorId: validAuthority.targetId }).success).toBe(false);
        expect(schemas.authoritySummarySchema.safeParse({
            id: validAuthority.targetId,
            email: 'directory@example.test',
            fullName: null,
            role: 'agent',
            parentId: validAuthority.parentId,
            franchiseId: validAuthority.franchiseId,
            authorityVersion: 2,
        }).success).toBe(true);
    });

    it('confines authority RPC names and the service client to one canonical command module', () => {
        expect(existsSync(commandsPath), 'missing profile-authority/commands.ts').toBe(true);
        if (!existsSync(commandsPath)) return;

        const commands = readFileSync(commandsPath, 'utf8');
        expect(commands).toContain("@/lib/supabase/service");
        for (const rpc of ['update_own_profile', 'update_team_member_name', 'change_profile_authority']) {
            expect(commands).toContain(`'${rpc}'`);
        }
        expect(commands).not.toMatch(/(?:update|upsert|insert|delete)Profile\s*\([^)]*payload/i);

        const offenders = sourceFiles(resolve(root, 'src'))
            .filter((path) => !path.includes(`${sep}__tests__${sep}`))
            .filter((path) => path !== commandsPath)
            .filter((path) => !path.endsWith('database.types.ts'))
            .filter((path) => /['"](?:update_own_profile|update_team_member_name|change_profile_authority)['"]/.test(
                readFileSync(path, 'utf8'),
            ));
        expect(offenders).toEqual([]);
    });

    it('keeps the service-role secret confined to the approved Supabase module', () => {
        const approved = resolve(root, 'src/lib/supabase/service.ts');
        const offenders = sourceFiles(resolve(root, 'src'))
            .filter((path) => !path.includes(`${sep}__tests__${sep}`))
            .filter((path) => path !== approved)
            .filter((path) => readFileSync(path, 'utf8').includes('SUPABASE_SERVICE_ROLE_KEY'));
        expect(offenders).toEqual([]);
    });
});

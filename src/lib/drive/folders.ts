/**
 * Folder resolution for invoice archiving.
 *
 * Each comercial (agent) gets ONE Drive folder, named by their full_name, holding
 * every invoice that agent uploads. The folder id is cached in
 * `profiles.drive_folder_id` so we never list Drive.
 *
 * Creating the folder is race-safe: two concurrent first-uploads by the same
 * agent may both create a folder in Drive, but only one can claim the DB slot
 * (atomic `UPDATE ... WHERE drive_folder_id IS NULL`). The loser deletes its
 * orphan folder and adopts the winner's id.
 *
 * The pure `resolveUserFolder` takes injected primitives so it is fully unit
 * testable; the DB/Drive wiring lives in the adapter below.
 */

import { createServiceClient } from '@/lib/supabase/service';
import type { DriveStorage } from './driveStorage';

export interface ResolveUserFolderDeps {
    /** Stable key used to cache/claim the folder (the agent id). */
    ownerKey: string;
    /** Human-readable Drive folder name (the comercial's full_name). */
    folderName: string;
    rootFolderId: string;
    /** Reads the cached folder id for this owner (or null). */
    getCachedFolderId: (ownerKey: string) => Promise<string | null>;
    /** Creates a Drive folder, returns its id. */
    createFolder: (input: { name: string; parentId: string }) => Promise<string>;
    /**
     * Atomically claims the folder id for the owner.
     * { claimed:true, current:folderId } if it won the slot, or
     * { claimed:false, current:<existing id> } if another writer got there first.
     */
    claimFolderId: (
        ownerKey: string,
        folderId: string,
    ) => Promise<{ claimed: boolean; current: string }>;
    /** Deletes an orphan folder created after losing the claim race. */
    deleteFolder: (folderId: string) => Promise<void>;
}

export async function resolveUserFolder(deps: ResolveUserFolderDeps): Promise<string> {
    const cached = await deps.getCachedFolderId(deps.ownerKey);
    if (cached) return cached;

    const created = await deps.createFolder({ name: deps.folderName, parentId: deps.rootFolderId });
    const { claimed, current } = await deps.claimFolderId(deps.ownerKey, created);

    if (!claimed && current !== created) {
        // Lost the race: another upload already claimed a folder. Drop ours.
        await deps.deleteFolder(created).catch(() => undefined);
        return current;
    }
    return current;
}

/** Strips path separators / control chars from a Drive folder name. */
export function sanitizeFolderName(raw: string | null | undefined): string {
    if (!raw) return '';
    return raw
        .replace(/[\\/\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
}

/**
 * DB/Drive-wired folder resolver for a given agent (comercial), using the
 * service role. Folder name is the agent's full_name; falls back to the agent
 * id if the name is empty.
 */
export async function resolveAgentFolder(
    drive: DriveStorage,
    rootFolderId: string,
    agentId: string,
): Promise<string> {
    const supabase = createServiceClient();
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, drive_folder_id')
        .eq('id', agentId)
        .single();
    const folderName = sanitizeFolderName(profile?.full_name) || agentId;

    return resolveUserFolder({
        ownerKey: agentId,
        folderName,
        rootFolderId,
        getCachedFolderId: async () => profile?.drive_folder_id ?? null,
        createFolder: (input) => drive.createFolder(input),
        claimFolderId: async (id, folderId) => {
            const { data: claimedRow } = await supabase
                .from('profiles')
                .update({ drive_folder_id: folderId })
                .eq('id', id)
                .is('drive_folder_id', null)
                .select('drive_folder_id')
                .maybeSingle();

            if (claimedRow?.drive_folder_id === folderId) {
                return { claimed: true, current: folderId };
            }
            const { data: existing } = await supabase
                .from('profiles')
                .select('drive_folder_id')
                .eq('id', id)
                .single();
            return { claimed: false, current: existing?.drive_folder_id ?? folderId };
        },
        deleteFolder: (folderId) => drive.deleteInvoice(folderId),
    });
}

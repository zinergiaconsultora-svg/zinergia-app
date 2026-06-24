import { describe, it, expect, vi } from 'vitest';
import { resolveUserFolder, sanitizeFolderName } from '../folders';

const agentId = 'agent-123';
const folderName = 'María García';
const rootFolderId = 'root';

describe('sanitizeFolderName', () => {
    it('strips path separators and collapses whitespace, keeps accents', () => {
        expect(sanitizeFolderName('María / García\n')).toBe('María García');
        expect(sanitizeFolderName('  Juan\tLópez  ')).toBe('Juan López');
    });
    it('returns empty string for null/empty input', () => {
        expect(sanitizeFolderName(null)).toBe('');
        expect(sanitizeFolderName('')).toBe('');
    });
});

describe('resolveUserFolder', () => {
    it('returns the cached folder id without creating anything', async () => {
        const createFolder = vi.fn();
        const claimFolderId = vi.fn();

        const id = await resolveUserFolder({
            ownerKey: agentId,
            folderName,
            rootFolderId,
            getCachedFolderId: async () => 'cached-folder',
            createFolder,
            claimFolderId,
            deleteFolder: vi.fn(),
        });

        expect(id).toBe('cached-folder');
        expect(createFolder).not.toHaveBeenCalled();
        expect(claimFolderId).not.toHaveBeenCalled();
    });

    it('creates a folder named by the comercial and claims it for the agent', async () => {
        const createFolder = vi.fn().mockResolvedValue('new-folder');
        const claimFolderId = vi.fn().mockResolvedValue({ claimed: true, current: 'new-folder' });

        const id = await resolveUserFolder({
            ownerKey: agentId,
            folderName,
            rootFolderId,
            getCachedFolderId: async () => null,
            createFolder,
            claimFolderId,
            deleteFolder: vi.fn(),
        });

        expect(id).toBe('new-folder');
        // Folder name is the comercial's name, under the root folder.
        expect(createFolder).toHaveBeenCalledWith({ name: folderName, parentId: rootFolderId });
        // Claim is keyed by the stable agent id, not the (possibly duplicate) name.
        expect(claimFolderId).toHaveBeenCalledWith(agentId, 'new-folder');
    });

    it('on a lost race, deletes the orphan folder and returns the winner', async () => {
        const createFolder = vi.fn().mockResolvedValue('my-orphan');
        const deleteFolder = vi.fn().mockResolvedValue(undefined);

        const id = await resolveUserFolder({
            ownerKey: agentId,
            folderName,
            rootFolderId,
            getCachedFolderId: async () => null,
            createFolder,
            claimFolderId: async () => ({ claimed: false, current: 'winner-folder' }),
            deleteFolder,
        });

        expect(id).toBe('winner-folder');
        expect(deleteFolder).toHaveBeenCalledWith('my-orphan');
    });
});

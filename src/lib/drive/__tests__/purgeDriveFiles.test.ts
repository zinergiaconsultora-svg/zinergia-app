import { describe, it, expect, vi } from 'vitest';
import { purgeDriveFiles } from '../purgeDriveFiles';

describe('purgeDriveFiles', () => {
    const files = [
        { jobId: 'j1', driveFileId: 'f1' },
        { jobId: 'j2', driveFileId: 'f2' },
    ];

    it('deletes every file and audits each', async () => {
        const deleteFile = vi.fn().mockResolvedValue(undefined);
        const audit = vi.fn().mockResolvedValue(undefined);

        const res = await purgeDriveFiles({ files, deleteFile, audit });

        expect(res).toEqual({ deleted: 2, failed: 0 });
        expect(deleteFile).toHaveBeenCalledTimes(2);
        expect(deleteFile).toHaveBeenCalledWith('f1');
        expect(audit).toHaveBeenCalledWith('j1', 'f1');
    });

    it('continues past a failure and counts it (best-effort)', async () => {
        const deleteFile = vi
            .fn()
            .mockRejectedValueOnce(new Error('drive down'))
            .mockResolvedValueOnce(undefined);
        const audit = vi.fn().mockResolvedValue(undefined);

        const res = await purgeDriveFiles({ files, deleteFile, audit });

        expect(res).toEqual({ deleted: 1, failed: 1 });
        // The failed file is not audited as deleted; the second still runs.
        expect(audit).toHaveBeenCalledTimes(1);
        expect(audit).toHaveBeenCalledWith('j2', 'f2');
    });

    it('no-ops on an empty list', async () => {
        const res = await purgeDriveFiles({ files: [], deleteFile: vi.fn(), audit: vi.fn() });
        expect(res).toEqual({ deleted: 0, failed: 0 });
    });
});

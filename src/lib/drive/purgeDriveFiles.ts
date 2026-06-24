/**
 * RGPD cascade — delete archived invoice files from Drive (pure orchestration).
 *
 * When a client's data is erased, their invoice files in Drive must go too. This
 * is the pure, injectable core (unit tested). Best-effort: a failure on one file
 * never stops the rest, and the caller decides what to do with the failed count
 * (the reconciliation job is the safety net for stragglers).
 *
 * The DB/Drive-wired version lives in purgeClientDriveFiles.ts.
 */

export interface DriveFileRef {
    jobId: string;
    driveFileId: string;
}

export interface PurgeDriveFilesDeps {
    files: DriveFileRef[];
    deleteFile: (driveFileId: string) => Promise<void>;
    audit: (jobId: string, driveFileId: string) => Promise<void>;
}

export async function purgeDriveFiles({
    files,
    deleteFile,
    audit,
}: PurgeDriveFilesDeps): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    for (const file of files) {
        try {
            await deleteFile(file.driveFileId);
            await audit(file.jobId, file.driveFileId);
            deleted++;
        } catch {
            failed++;
        }
    }

    return { deleted, failed };
}

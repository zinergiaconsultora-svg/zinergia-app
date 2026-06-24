/**
 * Pure decision helpers for Drive housekeeping (orphan detection + quota check),
 * kept free of DB/env imports so they're unit-testable. The wired job lives in
 * driveHousekeeping.ts.
 */

import type { DriveAppFile } from './driveStorage';

/**
 * Files whose stamped documentId no longer matches an existing ocr_job are
 * orphans (the job/client was deleted) — RGPD backstop. Files without a
 * documentId are left untouched.
 */
export function findOrphanFileIds(files: DriveAppFile[], existingJobIds: Set<string>): string[] {
    return files
        .filter((f) => f.documentId !== null && !existingJobIds.has(f.documentId))
        .map((f) => f.id);
}

/** True when usage is at/over the threshold fraction of a finite limit. */
export function isQuotaOverThreshold(usage: number, limit: number | null, threshold: number): boolean {
    if (limit === null || limit <= 0) return false;
    return usage / limit >= threshold;
}

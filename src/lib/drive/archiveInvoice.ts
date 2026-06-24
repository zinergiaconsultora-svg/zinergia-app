/**
 * Invoice archiving orchestration (pure).
 *
 * Uploads an OCR-job's file to the comercial's Drive folder and records the link.
 * Kept free of heavy/server-only imports (no next/server, no env) so it stays
 * unit-testable in isolation. The wired, non-blocking entry point used by the OCR
 * action lives in scheduleInvoiceArchive.ts.
 */

import type { DriveStorage } from './driveStorage';
import { buildInvoiceFileName } from './fileName';

export interface ArchiveInvoiceDeps {
    jobId: string;
    agentId: string;
    fileBuffer: Buffer;
    mimeType: string;
    invoiceDate?: string | Date;
    rootFolderId: string;
    // Only the upload capability is needed here; folder resolution is injected.
    drive: Pick<DriveStorage, 'uploadInvoice'>;
    resolveFolder: (agentId: string) => Promise<string>;
    markSynced: (
        jobId: string,
        info: { driveFileId: string; webViewLink: string | null },
    ) => Promise<void>;
}

export async function archiveInvoiceToDrive(deps: ArchiveInvoiceDeps): Promise<{ driveFileId: string }> {
    const folderId = await deps.resolveFolder(deps.agentId);
    const fileName = buildInvoiceFileName({
        documentId: deps.jobId,
        invoiceDate: deps.invoiceDate,
        mimeType: deps.mimeType,
    });
    const { driveFileId, webViewLink } = await deps.drive.uploadInvoice({
        folderId,
        fileName,
        buffer: deps.fileBuffer,
        mimeType: deps.mimeType,
        documentId: deps.jobId,
    });
    await deps.markSynced(deps.jobId, { driveFileId, webViewLink });
    return { driveFileId };
}

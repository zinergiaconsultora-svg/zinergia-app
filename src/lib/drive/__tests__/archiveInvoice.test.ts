import { describe, it, expect, vi } from 'vitest';
import { archiveInvoiceToDrive } from '../archiveInvoice';

describe('archiveInvoiceToDrive', () => {
    const baseDeps = () => ({
        jobId: 'job-uuid-1234abcd',
        agentId: 'agent-1',
        fileBuffer: Buffer.from('%PDF fake'),
        mimeType: 'application/pdf',
        invoiceDate: '2025-12-03',
        rootFolderId: 'root',
        resolveFolder: vi.fn().mockResolvedValue('agent-folder'),
        drive: {
            uploadInvoice: vi.fn().mockResolvedValue({
                driveFileId: 'file-1',
                webViewLink: 'https://drive/view',
            }),
            deleteInvoice: vi.fn(),
            createFolder: vi.fn(),
            getViewLink: vi.fn(),
        },
        markSynced: vi.fn().mockResolvedValue(undefined),
    });

    it('resolves the agent folder, uploads with a PII-free name, and marks synced', async () => {
        const deps = baseDeps();

        const result = await archiveInvoiceToDrive(deps);

        expect(deps.resolveFolder).toHaveBeenCalledWith('agent-1');
        expect(deps.drive.uploadInvoice).toHaveBeenCalledWith({
            folderId: 'agent-folder',
            fileName: 'factura-202512-jobuuid1.pdf', // built from jobId, no PII
            buffer: deps.fileBuffer,
            mimeType: 'application/pdf',
            documentId: 'job-uuid-1234abcd',
        });
        expect(deps.markSynced).toHaveBeenCalledWith('job-uuid-1234abcd', {
            driveFileId: 'file-1',
            webViewLink: 'https://drive/view',
        });
        expect(result).toEqual({ driveFileId: 'file-1' });
    });

    it('does not mark synced if the upload fails (left for reconciliation)', async () => {
        const deps = baseDeps();
        deps.drive.uploadInvoice.mockRejectedValue(new Error('drive down'));

        await expect(archiveInvoiceToDrive(deps)).rejects.toThrow('drive down');
        expect(deps.markSynced).not.toHaveBeenCalled();
    });
});

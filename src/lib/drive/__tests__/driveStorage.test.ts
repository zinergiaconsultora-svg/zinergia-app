import { describe, it, expect, vi } from 'vitest';
import { buildMultipartRelated, createDriveStorage } from '../driveStorage';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

const fakeCache = { get: async () => 'ya29.token' };

describe('buildMultipartRelated', () => {
    it('packs metadata + media into a multipart/related body', () => {
        const { contentType, body } = buildMultipartRelated({
            metadata: { name: 'factura-202512-a1b2c3d4.pdf', parents: ['folder1'] },
            mimeType: 'application/pdf',
            media: Buffer.from('%PDF-1.4 fake'),
            boundary: 'BOUNDARY',
        });

        expect(contentType).toBe('multipart/related; boundary=BOUNDARY');
        const text = body.toString('utf8');
        expect(text).toContain('--BOUNDARY');
        expect(text).toContain('"name":"factura-202512-a1b2c3d4.pdf"');
        expect(text).toContain('Content-Type: application/pdf');
        expect(text).toContain('%PDF-1.4 fake');
        expect(text.trimEnd().endsWith('--BOUNDARY--')).toBe(true);
    });
});

describe('createDriveStorage.uploadInvoice', () => {
    it('uploads with auth, stamps appProperties.documentId, returns id + link', async () => {
        const fetchFn = vi.fn().mockResolvedValue(
            jsonResponse({ id: 'file123', webViewLink: 'https://drive.google.com/file/d/file123/view' }),
        );
        const storage = createDriveStorage({ tokenCache: fakeCache, fetchFn });

        const result = await storage.uploadInvoice({
            folderId: 'folder1',
            fileName: 'factura-202512-a1b2c3d4.pdf',
            buffer: Buffer.from('data'),
            mimeType: 'application/pdf',
            documentId: 'doc-uuid',
        });

        expect(result).toEqual({
            driveFileId: 'file123',
            webViewLink: 'https://drive.google.com/file/d/file123/view',
        });

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toContain('/upload/drive/v3/files');
        expect(url).toContain('uploadType=multipart');
        expect(init.method).toBe('POST');
        expect(init.headers.authorization).toBe('Bearer ya29.token');
        expect(init.body.toString('utf8')).toContain('"documentId":"doc-uuid"');
        expect(init.body.toString('utf8')).toContain('"parents":["folder1"]');
    });

    it('throws when Drive rejects the upload', async () => {
        const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 403));
        const storage = createDriveStorage({ tokenCache: fakeCache, fetchFn });
        await expect(
            storage.uploadInvoice({
                folderId: 'f',
                fileName: 'n.pdf',
                buffer: Buffer.from('x'),
                mimeType: 'application/pdf',
                documentId: 'd',
            }),
        ).rejects.toThrow();
    });
});

describe('createDriveStorage.deleteInvoice', () => {
    it('issues a DELETE for the file id (RGPD cascade)', async () => {
        const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
        const storage = createDriveStorage({ tokenCache: fakeCache, fetchFn });

        await storage.deleteInvoice('file123');

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toContain('/drive/v3/files/file123');
        expect(init.method).toBe('DELETE');
        expect(init.headers.authorization).toBe('Bearer ya29.token');
    });

    it('treats an already-deleted file (404) as success — idempotent', async () => {
        const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
        const storage = createDriveStorage({ tokenCache: fakeCache, fetchFn });
        await expect(storage.deleteInvoice('gone')).resolves.toBeUndefined();
    });
});

describe('createDriveStorage.listAppFiles', () => {
    it('lists non-folder files with their documentId', async () => {
        const fetchFn = vi.fn().mockResolvedValue(
            jsonResponse({
                files: [
                    { id: 'f1', appProperties: { documentId: 'job-1' } },
                    { id: 'f2', appProperties: {} },
                ],
            }),
        );
        const storage = createDriveStorage({ tokenCache: fakeCache, fetchFn });
        const files = await storage.listAppFiles();
        expect(files).toEqual([
            { id: 'f1', documentId: 'job-1' },
            { id: 'f2', documentId: null },
        ]);
        const [url] = fetchFn.mock.calls[0];
        expect(decodeURIComponent(url)).toContain('application/vnd.google-apps.folder'); // q excludes folders
    });

    it('follows pagination via nextPageToken', async () => {
        const fetchFn = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'a', appProperties: { documentId: 'j-a' } }], nextPageToken: 'p2' }))
            .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'b', appProperties: { documentId: 'j-b' } }] }));
        const storage = createDriveStorage({ tokenCache: fakeCache, fetchFn });
        const files = await storage.listAppFiles();
        expect(files.map((f) => f.id)).toEqual(['a', 'b']);
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });
});

describe('createDriveStorage.getStorageQuota', () => {
    it('returns usage and limit as numbers', async () => {
        const fetchFn = vi.fn().mockResolvedValue(
            jsonResponse({ storageQuota: { usage: '12345', limit: '16106127360' } }),
        );
        const storage = createDriveStorage({ tokenCache: fakeCache, fetchFn });
        expect(await storage.getStorageQuota()).toEqual({ usage: 12345, limit: 16106127360 });
    });

    it('treats a missing limit as unlimited (null)', async () => {
        const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ storageQuota: { usage: '5' } }));
        const storage = createDriveStorage({ tokenCache: fakeCache, fetchFn });
        expect(await storage.getStorageQuota()).toEqual({ usage: 5, limit: null });
    });
});

describe('createDriveStorage.createFolder', () => {
    it('creates a folder under a parent and returns its id', async () => {
        const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ id: 'folderX' }));
        const storage = createDriveStorage({ tokenCache: fakeCache, fetchFn });

        const id = await storage.createFolder({ name: 'cliente-1', parentId: 'root' });

        expect(id).toBe('folderX');
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toContain('/drive/v3/files');
        expect(init.method).toBe('POST');
        expect(init.body).toContain('application/vnd.google-apps.folder');
        expect(init.body).toContain('"parents":["root"]');
    });
});

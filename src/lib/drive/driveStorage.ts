/**
 * DriveStorage — thin Google Drive v3 REST layer for invoice archiving.
 *
 * Behind this interface sits the only knowledge of how files reach Drive. Swapping
 * to a Service Account + Shared Drive later means implementing the same interface,
 * with no changes to callers (OCR action, reconciliation job, RGPD cascade).
 *
 * Scope is `drive.file`: the app only ever sees the files and folders it created.
 */

import type { TokenCache } from './tokenClient';

const UPLOAD_URL =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';

// Node's fetch accepts a Buffer body at runtime, but the DOM `BodyInit` type
// doesn't include it. Widen the body type so the multipart Buffer type-checks.
type DriveRequestInit = Omit<RequestInit, 'body'> & { body?: BodyInit | Buffer | null };
type FetchFn = (input: string, init: DriveRequestInit) => Promise<Response>;

interface MultipartInput {
    metadata: Record<string, unknown>;
    mimeType: string;
    media: Buffer;
    boundary: string;
}

/** Build a `multipart/related` body (metadata part + media part). Pure/testable. */
export function buildMultipartRelated({
    metadata,
    mimeType,
    media,
    boundary,
}: MultipartInput): { contentType: string; body: Buffer } {
    const head = Buffer.from(
        `--${boundary}\r\n` +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            `${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: ${mimeType}\r\n\r\n`,
        'utf8',
    );
    const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8');
    return {
        contentType: `multipart/related; boundary=${boundary}`,
        body: Buffer.concat([head, media, tail]),
    };
}

export interface UploadInvoiceInput {
    folderId: string;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
    /** Stamped into Drive appProperties so reconciliation can correlate files. */
    documentId: string;
}

export interface UploadInvoiceResult {
    driveFileId: string;
    webViewLink: string | null;
}

export interface DriveAppFile {
    id: string;
    documentId: string | null;
}

export interface DriveStorage {
    uploadInvoice(input: UploadInvoiceInput): Promise<UploadInvoiceResult>;
    deleteInvoice(driveFileId: string): Promise<void>;
    createFolder(input: { name: string; parentId: string }): Promise<string>;
    getViewLink(driveFileId: string): Promise<string | null>;
    /** Lists the (non-folder) files the app created, with their stamped documentId. */
    listAppFiles(): Promise<DriveAppFile[]>;
    /** Drive storage usage/limit in bytes (limit null = unlimited). */
    getStorageQuota(): Promise<{ usage: number; limit: number | null }>;
}

interface DriveStorageDeps {
    tokenCache: TokenCache;
    fetchFn?: FetchFn;
}

export function createDriveStorage({
    tokenCache,
    // Global fetch accepts a narrower body type; the cast lets us pass a Buffer.
    fetchFn = fetch as unknown as FetchFn,
}: DriveStorageDeps): DriveStorage {
    async function authHeader(): Promise<Record<string, string>> {
        const token = await tokenCache.get();
        return { authorization: `Bearer ${token}` };
    }

    return {
        async uploadInvoice({ folderId, fileName, buffer, mimeType, documentId }) {
            const boundary = `zinergia-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const { contentType, body } = buildMultipartRelated({
                metadata: { name: fileName, parents: [folderId], appProperties: { documentId } },
                mimeType,
                media: buffer,
                boundary,
            });

            const res = await fetchFn(UPLOAD_URL, {
                method: 'POST',
                headers: { ...(await authHeader()), 'content-type': contentType },
                body,
            });

            if (!res.ok) {
                throw new Error(`Drive upload failed (${res.status})`);
            }
            const data = (await res.json()) as { id: string; webViewLink?: string };
            return { driveFileId: data.id, webViewLink: data.webViewLink ?? null };
        },

        async deleteInvoice(driveFileId) {
            const res = await fetchFn(`${FILES_URL}/${driveFileId}`, {
                method: 'DELETE',
                headers: await authHeader(),
            });
            // 204 = deleted, 404 = already gone. Both are success for an idempotent purge.
            if (!res.ok && res.status !== 404) {
                throw new Error(`Drive delete failed (${res.status})`);
            }
        },

        async createFolder({ name, parentId }) {
            const res = await fetchFn(`${FILES_URL}?fields=id`, {
                method: 'POST',
                headers: { ...(await authHeader()), 'content-type': 'application/json' },
                body: JSON.stringify({
                    name,
                    parents: [parentId],
                    mimeType: 'application/vnd.google-apps.folder',
                }),
            });
            if (!res.ok) {
                throw new Error(`Drive folder creation failed (${res.status})`);
            }
            const data = (await res.json()) as { id: string };
            return data.id;
        },

        async getViewLink(driveFileId) {
            const res = await fetchFn(`${FILES_URL}/${driveFileId}?fields=webViewLink`, {
                method: 'GET',
                headers: await authHeader(),
            });
            if (!res.ok) return null;
            const data = (await res.json()) as { webViewLink?: string };
            return data.webViewLink ?? null;
        },

        async listAppFiles() {
            const out: DriveAppFile[] = [];
            let pageToken: string | undefined;
            const header = await authHeader();
            do {
                const params = new URLSearchParams({
                    q: "mimeType != 'application/vnd.google-apps.folder' and trashed = false",
                    fields: 'nextPageToken, files(id, appProperties)',
                    pageSize: '1000',
                });
                if (pageToken) params.set('pageToken', pageToken);
                const res = await fetchFn(`${FILES_URL}?${params.toString()}`, { method: 'GET', headers: header });
                if (!res.ok) throw new Error(`Drive list failed (${res.status})`);
                const data = (await res.json()) as {
                    nextPageToken?: string;
                    files?: Array<{ id: string; appProperties?: { documentId?: string } }>;
                };
                for (const f of data.files ?? []) {
                    out.push({ id: f.id, documentId: f.appProperties?.documentId ?? null });
                }
                pageToken = data.nextPageToken;
            } while (pageToken);
            return out;
        },

        async getStorageQuota() {
            const res = await fetchFn('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
                method: 'GET',
                headers: await authHeader(),
            });
            if (!res.ok) throw new Error(`Drive about failed (${res.status})`);
            const data = (await res.json()) as { storageQuota?: { usage?: string; limit?: string } };
            const q = data.storageQuota ?? {};
            return { usage: Number(q.usage ?? 0), limit: q.limit ? Number(q.limit) : null };
        },
    };
}

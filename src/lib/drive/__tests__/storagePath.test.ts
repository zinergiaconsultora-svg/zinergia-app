import { describe, it, expect } from 'vitest';
import { extractStoragePath } from '../storagePath';
import { mimeTypeForFileName } from '../fileName';

describe('extractStoragePath', () => {
    it('extracts the object path from a Supabase signed URL', () => {
        const url =
            'https://x.supabase.co/storage/v1/object/sign/ocr-invoices/agent-1/123_abc.pdf?token=eyJ';
        expect(extractStoragePath(url)).toBe('agent-1/123_abc.pdf');
    });

    it('url-decodes the extracted path', () => {
        const url = 'https://x/sign/ocr-invoices/agent%201/file%20a.pdf?token=t';
        expect(extractStoragePath(url)).toBe('agent 1/file a.pdf');
    });

    it('returns a bare path unchanged', () => {
        expect(extractStoragePath('agent-1/123.pdf')).toBe('agent-1/123.pdf');
    });

    it('returns null for an unrelated URL', () => {
        expect(extractStoragePath('https://example.com/other')).toBeNull();
    });
});

describe('mimeTypeForFileName', () => {
    it('maps known extensions', () => {
        expect(mimeTypeForFileName('factura.pdf')).toBe('application/pdf');
        expect(mimeTypeForFileName('FOTO.JPG')).toBe('image/jpeg');
        expect(mimeTypeForFileName('x.png')).toBe('image/png');
        expect(mimeTypeForFileName('x.webp')).toBe('image/webp');
    });
    it('defaults to PDF for unknown/missing extensions', () => {
        expect(mimeTypeForFileName('noext')).toBe('application/pdf');
    });
});

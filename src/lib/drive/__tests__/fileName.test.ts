import { describe, it, expect } from 'vitest';
import { buildInvoiceFileName, extensionForMime } from '../fileName';

describe('extensionForMime', () => {
    it('maps known invoice mime types', () => {
        expect(extensionForMime('application/pdf')).toBe('pdf');
        expect(extensionForMime('image/jpeg')).toBe('jpg');
        expect(extensionForMime('image/png')).toBe('png');
        expect(extensionForMime('image/webp')).toBe('webp');
    });

    it('falls back to bin for unknown types', () => {
        expect(extensionForMime('application/octet-stream')).toBe('bin');
        expect(extensionForMime('')).toBe('bin');
    });
});

describe('buildInvoiceFileName', () => {
    const documentId = 'a1b2c3d4-5678-90ab-cdef-1234567890ab';

    it('builds a neutral name: factura-<yyyymm>-<shortid>.<ext>', () => {
        const name = buildInvoiceFileName({
            documentId,
            invoiceDate: '2025-12-03',
            mimeType: 'application/pdf',
        });
        expect(name).toBe('factura-202512-a1b2c3d4.pdf');
    });

    it('derives the month from a Date instance too', () => {
        const name = buildInvoiceFileName({
            documentId,
            invoiceDate: new Date('2025-01-15T00:00:00Z'),
            mimeType: 'image/png',
        });
        expect(name).toBe('factura-202501-a1b2c3d4.png');
    });

    it('falls back to "sinfecha" when the invoice date is missing or invalid', () => {
        expect(
            buildInvoiceFileName({ documentId, mimeType: 'application/pdf' }),
        ).toBe('factura-sinfecha-a1b2c3d4.pdf');
        expect(
            buildInvoiceFileName({ documentId, invoiceDate: 'not-a-date', mimeType: 'application/pdf' }),
        ).toBe('factura-sinfecha-a1b2c3d4.pdf');
    });

    it('never leaks PII: output contains only the prefix, month and short id', () => {
        const name = buildInvoiceFileName({
            documentId,
            invoiceDate: '2025-12-03',
            mimeType: 'application/pdf',
        });
        // Strict shape — no titular, CUPS, DNI or original filename can appear.
        expect(name).toMatch(/^factura-(\d{6}|sinfecha)-[a-z0-9]{8}\.[a-z]+$/);
    });

    it('throws on a missing document id rather than producing a nameless file', () => {
        expect(() =>
            buildInvoiceFileName({ documentId: '', mimeType: 'application/pdf' }),
        ).toThrow();
    });
});

import { describe, it, expect } from 'vitest';
import { extractSyncDataFromResponse, parseRawInvoiceData } from '../dispatch';

function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}

describe('parseRawInvoiceData', () => {
    it('coerces numeric strings to numbers', () => {
        const result = parseRawInvoiceData({
            power_p1: '4.6',
            energy_p1: '150',
            client_name: 'ACME',
        });
        expect(result.power_p1).toBe(4.6);
        expect(result.energy_p1).toBe(150);
        // Passthrough preserves unknown fields.
        expect(result.client_name).toBe('ACME');
    });

    it('returns original data untouched on validation failure', () => {
        // Negative numbers violate `.nonnegative()` → schema fails → returns raw.
        const raw = { power_p1: -5, client_name: 'X' };
        const result = parseRawInvoiceData(raw);
        expect(result).toEqual(raw);
    });

    it('preserves non-schema fields via passthrough', () => {
        const result = parseRawInvoiceData({ totally_custom: 'yes' });
        expect(result.totally_custom).toBe('yes');
    });
});

describe('extractSyncDataFromResponse', () => {
    it('returns null for non-JSON responses', async () => {
        const res = new Response('not json', {
            headers: { 'content-type': 'text/plain' },
        });
        expect(await extractSyncDataFromResponse(res)).toBeNull();
    });

    it('returns null when JSON has no meaningful fields', async () => {
        const res = jsonResponse({ status: 'ok', job_id: 'abc' });
        expect(await extractSyncDataFromResponse(res)).toBeNull();
    });

    it('extracts data from { data: {...} } shape', async () => {
        const res = jsonResponse({
            data: {
                client_name: 'ACME',
                cups: 'ES0021000000000000XX',
                total: '121,50',
            },
        });
        const out = await extractSyncDataFromResponse(res);
        expect(out?.client_name).toBe('ACME');
    });

    it('extracts data from [{ output: {...} }] (N8N array-wrapped)', async () => {
        const res = jsonResponse([
            {
                output: {
                    CLIENTE_NOMBRE: 'ACME SA',
                    CUPS: 'ES00',
                    TOTAL: '100',
                },
            },
        ]);
        const out = await extractSyncDataFromResponse(res);
        expect(out?.CLIENTE_NOMBRE).toBe('ACME SA');
    });

    it('falls back to the body itself when it looks like data', async () => {
        const res = jsonResponse({
            client_name: 'ACME',
            cups: 'ES00',
            total_amount: 100,
            dni_cif: 'B1',
        });
        const out = await extractSyncDataFromResponse(res);
        expect(out?.client_name).toBe('ACME');
    });

    it('accepts uppercase Spanish field variants', async () => {
        // Callback parseNumber() downstream is responsible for coercing the
        // UPPERCASE variants — the zod schema here only coerces the lowercase
        // ones. Uppercase fields should still pass through intact.
        const res = jsonResponse({
            TITULAR: 'María',
            POTENCIA_P1: '4.6',
            ENERGIA_P1: '150',
            IMPORTE_TOTAL: '100',
        });
        const out = await extractSyncDataFromResponse(res);
        expect(out?.TITULAR).toBe('María');
        expect(out?.POTENCIA_P1).toBe('4.6'); // string, not coerced
    });

    it('returns null when the response is invalid JSON', async () => {
        const res = new Response('{not valid', {
            headers: { 'content-type': 'application/json' },
        });
        expect(await extractSyncDataFromResponse(res)).toBeNull();
    });

    it('rejects candidates with too few keys (noise)', async () => {
        // < 3 keys → schema considers it "not meaningful data"
        const res = jsonResponse({ client_name: 'ACME', cups: 'ES00' });
        expect(await extractSyncDataFromResponse(res)).toBeNull();
    });
});

/**
 * Webhook Proxy API Route - OCR Processing
 * 
 * Security measures:
 * - Webhook URL hidden in server-side code
 * - API key authentication required
 * - Request validation
 * - Rate limiting by IP
 * - Sanitized logging
 * - Response validation
 */

import { NextRequest, NextResponse } from 'next/server';

// Environment variables (NEVER expose webhook URLs in client code)
const OCR_WEBHOOK_URL = process.env.OCR_WEBHOOK_URL!;
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY!;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf'];

// Rate limiting (in production, use Redis or similar)
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 10;

    const record = rateLimiter.get(ip);

    if (!record || now > record.resetTime) {
        rateLimiter.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (record.count >= maxRequests) {
        return false;
    }

    record.count++;
    return true;
}

export async function POST(request: NextRequest) {
    try {
        // 1. Check API Key
        const apiKey = request.headers.get('x-api-key');

        // Diagnostic logs (visible in Vercel Logs)
        if (!WEBHOOK_API_KEY) {
            console.error('SERVER ERROR: Missing WEBHOOK_API_KEY in environment!');
        }

        if (apiKey !== WEBHOOK_API_KEY) {
            console.warn(`AUTH FAILURE: Received key length ${apiKey?.length || 0}, expected ${WEBHOOK_API_KEY?.length || 0}`);
            return NextResponse.json(
                {
                    error: 'Unauthorized',
                    message: 'La clave de API no coincide o no está configurada en el servidor. Revisa las variables de entorno en Vercel.',
                    debug: process.env.NODE_ENV === 'development' ? { received: apiKey, expected: WEBHOOK_API_KEY } : undefined
                },
                { status: 401 }
            );
        }

        // 2. Rate limiting
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { error: 'Too Many Requests', message: 'Rate limit exceeded' },
                { status: 429 }
            );
        }

        // 3. Parse form data
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'No file provided' },
                { status: 400 }
            );
        }

        // 4. Validate file
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid File', message: 'Only PDF files are allowed' },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File Too Large', message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        // 5. Validate PDF magic number (first 4 bytes)
        const arrayBuffer = await file.slice(0, 4).arrayBuffer();
        const view = new DataView(arrayBuffer);
        const pdfSignature = view.getUint32(0, false); // Big-endian

        if (pdfSignature !== 0x25504446) { // '%PDF'
            return NextResponse.json(
                { error: 'Invalid File', message: 'File is not a valid PDF' },
                { status: 400 }
            );
        }

        // 6. Forward to webhook (server-side, URL hidden)
        const webhookFormData = new FormData();
        webhookFormData.append('file', file);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(OCR_WEBHOOK_URL, {
            method: 'POST',
            body: webhookFormData,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`OCR Webhook failed: ${response.status} ${response.statusText}`);
            return NextResponse.json(
                { error: 'Webhook Error', message: 'Failed to process document' },
                { status: 502 }
            );
        }

        // 7. Parse and validate response
        const responseData = await response.json();
        const data = Array.isArray(responseData) ? responseData[0]?.output || responseData[0] : responseData?.output || responseData;

        if (!data) {
            return NextResponse.json(
                { error: 'Invalid Response', message: 'Webhook returned invalid data' },
                { status: 502 }
            );
        }

        // 8. Sanitize and validate response data
        const sanitizeNumber = (value: any, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
            if (!value) return 0;
            const strValue = String(value).replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(strValue);
            if (isNaN(parsed)) return 0;
            return Math.max(min, Math.min(max, parsed));
        };

        const sanitizeString = (value: any, maxLength = 500): string => {
            if (!value) return '';
            const str = String(value).trim();
            return str.substring(0, maxLength);
        };

        // Build sanitized response
        const sanitized = {
            client_name: sanitizeString(data.client_name || data.CLIENTE_NOMBRE || data.cliente_nombre, 200),
            dni_cif: sanitizeString(data.dni_cif || data.nif_cif, 20),
            company_name: sanitizeString(data.company_name || data.COMERCIALIZADORA || data.compania, 200),
            cups: sanitizeString(data.cups || data.CUPS, 25),
            tariff_name: sanitizeString(data.tariff_name || data.TARIFA || data.tarifa, 100),
            invoice_number: sanitizeString(data.invoice_number || data.NUMERO_FACTURA || data.numero_factura, 50),
            invoice_date: sanitizeString(data.invoice_date || data.FECHA_FACTURA || data.fecha_factura, 20),
            supply_address: sanitizeString(data.supply_address || data.direccion_suministro, 500),

            period_days: sanitizeNumber(data.period_days || data.periodo_facturacion, 1, 365),
            subtotal: sanitizeNumber(data.subtotal, 0, 1000000),
            vat: sanitizeNumber(data.iva, 0, 1000000),
            total_amount: sanitizeNumber(data.importe_total || data.total, 0, 10000000),
            rights_cost: sanitizeNumber(data.derechos_enganche, 0, 100000),

            power_p1: sanitizeNumber(data.power_p1 || data.POTENCIA_P1 || data.potencia_p1, 0, 100),
            power_p2: sanitizeNumber(data.power_p2 || data.POTENCIA_P2 || data.potencia_p2, 0, 100),
            power_p3: sanitizeNumber(data.power_p3 || data.POTENCIA_P3 || data.potencia_p3, 0, 100),
            power_p4: sanitizeNumber(data.power_p4 || data.POTENCIA_P4 || data.potencia_p4, 0, 100),
            power_p5: sanitizeNumber(data.power_p5 || data.POTENCIA_P5 || data.potencia_p5, 0, 100),
            power_p6: sanitizeNumber(data.power_p6 || data.POTENCIA_P6 || data.potencia_p6, 0, 100),

            energy_p1: sanitizeNumber(data.energy_p1 || data.ENERGIA_P1 || data.energia_p1, 0, 100000),
            energy_p2: sanitizeNumber(data.energy_p2 || data.ENERGIA_P2 || data.energia_p2, 0, 100000),
            energy_p3: sanitizeNumber(data.energy_p3 || data.ENERGIA_P3 || data.energia_p3, 0, 100000),
            energy_p4: sanitizeNumber(data.energy_p4 || data.ENERGIA_P4 || data.energia_p4, 0, 100000),
            energy_p5: sanitizeNumber(data.energy_p5 || data.ENERGIA_P5 || data.energia_p5, 0, 100000),
            energy_p6: sanitizeNumber(data.energy_p6 || data.ENERGIA_P6 || data.energia_p6, 0, 100000),
        };

        // 9. Log sanitized data only (NO PII)
        console.log('Document processed successfully', {
            fileName: file.name,
            fileSize: file.size,
            tariffType: sanitized.tariff_name,
            periodDays: sanitized.period_days,
            // NO client_name, dni_cif, cups, etc.
        });

        return NextResponse.json(sanitized);

    } catch (error) {
        // Check for timeout
        if (error instanceof Error && error.name === 'AbortError') {
            return NextResponse.json(
                { error: 'Timeout', message: 'Processing timed out' },
                { status: 504 }
            );
        }

        console.error('OCR Proxy error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

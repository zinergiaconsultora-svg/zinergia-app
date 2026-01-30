/**
 * Webhook Proxy API Route - Tariff Comparison
 * 
 * Security measures:
 * - Webhook URL hidden in server-side code
 * - API key authentication required
 * - Request validation
 * - Rate limiting by IP
 * - Sanitized logging
 * - Response validation with Zod schema
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Environment variables (NEVER expose webhook URLs in client code)
const COMPARISON_WEBHOOK_URL = process.env.COMPARISON_WEBHOOK_URL!;
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY!;

// Rate limiting (in production, use Redis or similar)
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 20; // Comparison is faster, allow more

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

// Zod schema for request validation
const InvoiceDataSchema = z.object({
    period_days: z.number().min(1).max(365).optional(),
    power_p1: z.number().min(0).max(100),
    power_p2: z.number().min(0).max(100),
    power_p3: z.number().min(0).max(100),
    power_p4: z.number().min(0).max(100),
    power_p5: z.number().min(0).max(100),
    power_p6: z.number().min(0).max(100),
    energy_p1: z.number().min(0).max(100000),
    energy_p2: z.number().min(0).max(100000),
    energy_p3: z.number().min(0).max(100000),
    energy_p4: z.number().min(0).max(100000),
    energy_p5: z.number().min(0).max(100000),
    energy_p6: z.number().min(0).max(100000),
    
    // Optional fields
    client_name: z.string().max(200).optional(),
    dni_cif: z.string().max(20).optional(),
    company_name: z.string().max(200).optional(),
    cups: z.string().max(25).optional(),
    tariff_name: z.string().max(100).optional(),
    invoice_number: z.string().max(50).optional(),
    invoice_date: z.string().max(20).optional(),
    supply_address: z.string().max(500).optional(),
    subtotal: z.number().min(0).optional(),
    vat: z.number().min(0).optional(),
    total_amount: z.number().min(0).optional(),
});

// Zod schema for response validation
const OfferSchema = z.object({
    id: z.string(),
    marketer_name: z.string(),
    tariff_name: z.string(),
    logo_color: z.string().optional(),
    type: z.enum(['fixed', 'indexed']),
    power_price: z.object({
        p1: z.number(),
        p2: z.number(),
        p3: z.number(),
        p4: z.number(),
        p5: z.number(),
        p6: z.number(),
    }),
    energy_price: z.object({
        p1: z.number(),
        p2: z.number(),
        p3: z.number(),
        p4: z.number(),
        p5: z.number(),
        p6: z.number(),
    }),
    fixed_fee: z.number(),
    contract_duration: z.string(),
    annual_cost: z.number().optional(),
    optimization_result: z.object({
        optimized_powers: z.object({
            p1: z.number(),
            p2: z.number(),
            p3: z.number(),
            p4: z.number(),
            p5: z.number(),
            p6: z.number(),
        }),
        original_annual_fixed_cost: z.number(),
        optimized_annual_fixed_cost: z.number(),
        annual_optimization_savings: z.number(),
    }).optional(),
});

const ComparisonResponseSchema = z.object({
    current_annual_cost: z.number(),
    offers: z.array(OfferSchema).min(1).max(10),
});

export async function POST(request: NextRequest) {
    try {
        // 1. Check API Key
        const apiKey = request.headers.get('x-api-key');
        if (apiKey !== WEBHOOK_API_KEY) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Invalid API key' },
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

        // 3. Parse and validate request body
        const body = await request.json();
        const validationResult = InvoiceDataSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { 
                    error: 'Validation Error', 
                    message: 'Invalid invoice data',
                    details: validationResult.error.issues 
                },
                { status: 400 }
            );
        }

        const invoiceData = validationResult.data;

        // 4. Log sanitized request (NO PII)
        console.log('Tariff comparison requested', {
            tariffType: invoiceData.tariff_name,
            totalAmount: invoiceData.total_amount,
            periodDays: invoiceData.period_days,
        });

        // 5. Forward to webhook (server-side, URL hidden)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(COMPARISON_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invoiceData),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`Comparison Webhook failed: ${response.status} ${response.statusText}`);
            return NextResponse.json(
                { error: 'Webhook Error', message: 'Failed to compare tariffs' },
                { status: 502 }
            );
        }

        // 6. Parse and validate response
        const responseData = await response.json();
        const data = Array.isArray(responseData) ? responseData[0]?.output || responseData[0] : responseData?.output || responseData;

        if (!data) {
            return NextResponse.json(
                { error: 'Invalid Response', message: 'Webhook returned invalid data' },
                { status: 502 }
            );
        }

        // Validate response structure with Zod
        const validatedResponse = ComparisonResponseSchema.safeParse(data);

        if (!validatedResponse.success) {
            console.error('Webhook response validation failed:', validatedResponse.error.issues);
            return NextResponse.json(
                { 
                    error: 'Invalid Response', 
                    message: 'Webhook returned malformed data',
                    details: validatedResponse.error.issues 
                },
                { status: 502 }
            );
        }

        // 7. Log sanitized response (NO PII)
        console.log('Tariff comparison completed', {
            offersCount: validatedResponse.data.offers.length,
            currentAnnualCost: validatedResponse.data.current_annual_cost,
        });

        return NextResponse.json(validatedResponse.data);

    } catch (error) {
        // Check for timeout
        if (error instanceof Error && error.name === 'AbortError') {
            return NextResponse.json(
                { error: 'Timeout', message: 'Comparison timed out' },
                { status: 504 }
            );
        }

        console.error('Comparison Proxy error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

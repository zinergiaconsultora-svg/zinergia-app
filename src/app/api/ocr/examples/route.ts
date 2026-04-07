import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * GET /api/ocr/examples?company=NATURGY&limit=5&validated_only=false
 *
 * Endpoint para N8N. Devuelve ejemplos de extracción previa agrupados
 * por comercializadora, listos para usarse como few-shot context.
 *
 * Autenticación: x-api-key (mismo que el callback OCR).
 *
 * Respuesta:
 * {
 *   company: "NATURGY",
 *   total: 12,
 *   examples: [
 *     {
 *       extracted_fields: { client_name, power_p1, energy_p1, … },
 *       raw_text_sample: "…primeros 500 chars del PDF…",
 *       is_validated: true,
 *       confidence_avg: 0.92
 *     },
 *     …
 *   ],
 *   prompt_hint: "…bloque de texto listo para pegar en el prompt de N8N…"
 * }
 */
export async function GET(request: Request) {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== env.WEBHOOK_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Params ───────────────────────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const rawCompany = searchParams.get('company') ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 10);
    const validatedOnly = searchParams.get('validated_only') === 'true';

    if (!rawCompany) {
        return NextResponse.json({ error: 'Missing company parameter' }, { status: 400 });
    }

    // Normalizar: "Naturgy S.A." → "NATURGY"
    const company = normalizeCompanyName(rawCompany);

    // ── DB ───────────────────────────────────────────────────────────────────
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    let query = supabase
        .from('ocr_training_examples')
        .select('extracted_fields, raw_text_sample, is_validated, confidence_avg, created_at')
        .eq('company_name', company)
        .order('is_validated', { ascending: false })   // validados primero
        .order('confidence_avg', { ascending: false })  // mayor confianza primero
        .order('created_at', { ascending: false })
        .limit(limit);

    if (validatedOnly) {
        query = query.eq('is_validated', true);
    }

    const { data: examples, error, count } = await supabase
        .from('ocr_training_examples')
        .select('extracted_fields, raw_text_sample, is_validated, confidence_avg, created_at', { count: 'exact' })
        .eq('company_name', company)
        .order('is_validated', { ascending: false })
        .order('confidence_avg', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!examples || examples.length === 0) {
        return NextResponse.json({
            company,
            total: 0,
            examples: [],
            prompt_hint: null,
        });
    }

    // ── Construir prompt_hint listo para pegar en N8N ─────────────────────
    const promptHint = buildPromptHint(company, examples as ExampleRow[]);

    return NextResponse.json({
        company,
        total: count ?? examples.length,
        examples,
        prompt_hint: promptHint,
    });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExampleRow {
    extracted_fields: Record<string, unknown>;
    raw_text_sample: string | null;
    is_validated: boolean;
    confidence_avg: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normaliza el nombre de la comercializadora al formato canónico.
 * "Naturgy S.A." → "NATURGY" | "endesa energía" → "ENDESA"
 */
function normalizeCompanyName(raw: string): string {
    return raw
        .toUpperCase()
        .replace(/\bS\.?A\.?\b|\bS\.?L\.?\b|\bS\.?A\.?U\.?\b/g, '') // quita formas jurídicas
        .replace(/ENERGIA|ENERGÍA|ENERGY/g, '')
        .replace(/[^A-ZÁÉÍÓÚÑ0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        // Mapeo canónico de variantes conocidas
        .replace(/^NATURGY.*/, 'NATURGY')
        .replace(/^ENDESA.*/, 'ENDESA')
        .replace(/^IBERDROLA.*/, 'IBERDROLA')
        .replace(/^REPSOL.*/, 'REPSOL')
        .replace(/^EDP.*/, 'EDP')
        .replace(/^HOLALUZ.*/, 'HOLALUZ')
        .replace(/^OCTOPUS.*/, 'OCTOPUS')
        .replace(/^PODO.*/, 'PODO');
}

/**
 * Construye un bloque de texto con los ejemplos formateado para el prompt de N8N.
 * N8N puede pegarlo directamente en el system prompt antes de pedir la extracción.
 */
function buildPromptHint(company: string, examples: ExampleRow[]): string {
    const header = `A continuación hay ${examples.length} ejemplo${examples.length > 1 ? 's' : ''} de facturas de ${company} procesadas correctamente. Úsalos como referencia para extraer los mismos campos de la nueva factura.`;

    const blocks = examples.map((ex, i) => {
        const validated = ex.is_validated ? ' [VALIDADO POR AGENTE]' : '';
        const conf = ex.confidence_avg != null ? ` (confianza ${(ex.confidence_avg * 100).toFixed(0)}%)` : '';

        const fields = formatExtractedFields(ex.extracted_fields);
        const textSample = ex.raw_text_sample
            ? `\nTexto de referencia:\n"""\n${ex.raw_text_sample.slice(0, 400)}\n"""`
            : '';

        return `--- Ejemplo ${i + 1}${validated}${conf} ---${textSample}\nCampos extraídos:\n${fields}`;
    });

    return [header, ...blocks].join('\n\n');
}

/**
 * Formatea los campos extraídos como lista legible para el LLM.
 * Omite campos internos (_confidence, etc.) y nulls.
 */
function formatExtractedFields(fields: Record<string, unknown>): string {
    const SKIP = new Set(['_confidence', 'forensic_details']);
    return Object.entries(fields)
        .filter(([k, v]) => !SKIP.has(k) && v !== null && v !== undefined && v !== '' && v !== 0)
        .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
        .join('\n');
}

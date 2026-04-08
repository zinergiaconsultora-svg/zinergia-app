'use server';

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { InvoiceData } from '@/types/crm';

/**
 * Fase 2 — Corrección humana en el loop.
 *
 * Cuando el agente modifica los datos extraídos por OCR y pulsa
 * "Confirmar datos", esta action:
 *
 * 1. Detecta qué campos cambiaron respecto al original (OCR raw).
 * 2. Guarda o actualiza el ejemplo en ocr_training_examples con
 *    is_validated = true y corrected_fields = datos corregidos.
 * 3. Devuelve el número de campos corregidos para feedback en UI.
 *
 * Los ejemplos validados manualmente tienen más peso en el few-shot
 * (el endpoint /api/ocr/examples los devuelve primero).
 */
export async function confirmOcrExtractionAction(
    jobId: string,
    correctedData: InvoiceData
): Promise<{ correctedFieldsCount: number; alreadyValidated: boolean }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('Server misconfigured');
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    // 1. Recuperar el ejemplo asociado al job
    const { data: existing } = await admin
        .from('ocr_training_examples')
        .select('id, extracted_fields, is_validated')
        .eq('ocr_job_id', jobId)
        .maybeSingle();

    // Calcular diff: campos que el agente modificó respecto al original
    const originalFields = (existing?.extracted_fields ?? {}) as Record<string, unknown>;
    const correctedFields = correctedData as unknown as Record<string, unknown>;
    const changedFields = findChangedFields(originalFields, correctedFields);

    if (existing) {
        // Actualizar ejemplo existente — corrected_fields solo si hay cambios reales
        await admin
            .from('ocr_training_examples')
            .update({
                corrected_fields: Object.keys(changedFields).length > 0 ? correctedFields : null,
                is_validated: true,
            })
            .eq('id', existing.id);

        return {
            correctedFieldsCount: Object.keys(changedFields).length,
            alreadyValidated: existing.is_validated,
        };
    }

    // 2. Si no existe el ejemplo (job muy antiguo o guardado falló), crearlo ahora.
    // Sin un original de referencia no podemos calcular un diff real →
    // corrected_fields = null (semánticamente correcto: no sabemos qué corrigió el agente).
    const companyName = normalizeCompanyName(
        (correctedData.company_name as string | undefined) ?? ''
    );

    if (companyName) {
        const fileHash = `confirm|${jobId}`;
        await admin
            .from('ocr_training_examples')
            .upsert({
                company_name: companyName,
                file_hash: fileHash,
                extracted_fields: correctedFields,
                corrected_fields: null,
                is_validated: true,
                ocr_job_id: jobId,
            }, { onConflict: 'file_hash', ignoreDuplicates: false });
    }

    return {
        correctedFieldsCount: Object.keys(changedFields).length,
        alreadyValidated: false,
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKIP_FIELDS = new Set([
    '_confidence', 'client_id', 'forensic_details',
]);

const NUMERIC_FIELDS = new Set([
    'power_p1', 'power_p2', 'power_p3', 'power_p4', 'power_p5', 'power_p6',
    'energy_p1', 'energy_p2', 'energy_p3', 'energy_p4', 'energy_p5', 'energy_p6',
    'period_days', 'total_amount', 'subtotal', 'vat',
]);

/**
 * Devuelve solo los campos que cambiaron entre el original y lo corregido.
 * Para numéricos, considera "cambio" si la diferencia > 0.001.
 */
function findChangedFields(
    original: Record<string, unknown>,
    corrected: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
    const changed: Record<string, { from: unknown; to: unknown }> = {};

    for (const [key, newVal] of Object.entries(corrected)) {
        if (SKIP_FIELDS.has(key)) continue;
        const oldVal = original[key];
        if (oldVal === undefined && (newVal === null || newVal === '' || newVal === 0)) continue;

        if (NUMERIC_FIELDS.has(key)) {
            const oldN = Number(oldVal ?? 0);
            const newN = Number(newVal ?? 0);
            if (Math.abs(oldN - newN) > 0.001) {
                changed[key] = { from: oldN, to: newN };
            }
        } else {
            if (String(oldVal ?? '').trim() !== String(newVal ?? '').trim()) {
                changed[key] = { from: oldVal, to: newVal };
            }
        }
    }

    return changed;
}

function normalizeCompanyName(raw: string): string {
    const cleaned = raw
        .toUpperCase()
        .replace(/\bS\.?A\.?\b|\bS\.?L\.?\b|\bS\.?A\.?U\.?\b/g, '')
        .replace(/ENERGIA|ENERGÍA|ENERGY/g, '')
        .replace(/[^A-ZÁÉÍÓÚÑ0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Buscar por presencia (no solo al inicio) para capturar nombres como
    // "GRUPO IBERDROLA", "DISTRIBUIDORA ENDESA S.L.", etc.
    const CANONICAL: [RegExp, string][] = [
        [/NATURGY/, 'NATURGY'],
        [/ENDESA/, 'ENDESA'],
        [/IBERDROLA/, 'IBERDROLA'],
        [/REPSOL/, 'REPSOL'],
        [/\bEDP\b/, 'EDP'],
        [/HOLALUZ/, 'HOLALUZ'],
        [/OCTOPUS/, 'OCTOPUS'],
        [/PODO/, 'PODO'],
    ];

    for (const [pattern, canonical] of CANONICAL) {
        if (pattern.test(cleaned)) return canonical;
    }

    return cleaned;
}

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';

/**
 * Porcentaje de comisión de cada colaborador, y el extra por operación.
 *
 * Las dos escrituras van por funciones de base de datos que comprueban el rol
 * dentro y dejan registrado quién y cuándo. Aquí sólo se valida la forma de los
 * datos y se traducen los errores a algo que un administrador pueda leer.
 */

const rateSchema = z.object({
    profileId: z.uuid(),
    // Puntos básicos: 6500 = 65 %.
    rateBps: z.number().int().min(0).max(10000),
    note: z.string().trim().max(500).optional(),
});

const extraSchema = z.object({
    opportunityId: z.uuid(),
    amount: z.number().min(0).max(100000),
    reason: z.string().trim().max(500).optional(),
});

export interface CollaboratorRate {
    rateBps: number;
    effectiveFrom: string;
    note: string | null;
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Traduce el error de la base de datos sin repetir su texto.
 *
 * El mensaje de Postgres puede llevar nombres de función y de tabla; devolverlo
 * tal cual al navegador describe la trastienda a quien no debería verla.
 */
function readableError(code: string | undefined, fallback: string): string {
    if (code === '42501') return 'No tienes permiso para cambiar comisiones.';
    if (code === '22023') return 'El valor no es válido.';
    if (code === '23503') return 'No se ha encontrado el destinatario del cambio.';
    return fallback;
}

export async function setCollaboratorRateAction(input: unknown): Promise<Result<null>> {
    await requireServerRole(['admin']);

    const parsed = rateSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: 'El porcentaje debe estar entre 0 y 100.' };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc('set_collaborator_commission_rate', {
        p_profile_id: parsed.data.profileId,
        p_rate_bps: parsed.data.rateBps,
        p_note: parsed.data.note ?? null,
    });

    if (error) {
        return { success: false, error: readableError(error.code, 'No se pudo guardar la comisión.') };
    }

    revalidatePath('/admin/agents');
    revalidatePath('/dashboard/commissions');
    return { success: true, data: null };
}

/**
 * El porcentaje vigente de un colaborador, y su historial.
 *
 * Devuelve el historial entero a propósito: el administrador necesita poder
 * responder "¿por qué esta operación pagó otro porcentaje?" sin salir de la
 * pantalla. Las políticas de la tabla ya impiden que un colaborador vea el de
 * otro.
 */
export async function getCollaboratorRatesAction(profileId: string): Promise<CollaboratorRate[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    if (!z.uuid().safeParse(profileId).success) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('collaborator_commission_rates')
        .select('rate_bps, effective_from, note')
        .eq('profile_id', profileId)
        .order('effective_from', { ascending: false });

    if (error) return [];

    return (data ?? []).map(row => ({
        rateBps: row.rate_bps,
        effectiveFrom: row.effective_from,
        note: row.note,
    }));
}

export async function setOpportunityExtraAction(input: unknown): Promise<Result<null>> {
    await requireServerRole(['admin']);

    const parsed = extraSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: 'El importe debe ser un número entre 0 y 100.000 €.' };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc('set_opportunity_extra_commission', {
        p_opportunity_id: parsed.data.opportunityId,
        p_amount: parsed.data.amount,
        p_reason: parsed.data.reason ?? null,
    });

    if (error) {
        return { success: false, error: readableError(error.code, 'No se pudo guardar el extra.') };
    }

    revalidatePath('/admin/leads');
    return { success: true, data: null };
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import { Offer } from '@/types/crm'
import { ActionResult, actionError, actionSuccess } from './helpers'
import { offerSchema, uuidSchema } from '@/lib/validation/schemas'
import { logAdminAction } from '@/lib/audit/logger'

export async function saveOfferAction(offer: Partial<Offer>): Promise<ActionResult<Offer>> {
    await requireServerRole(['admin', 'franchise'])

    const parsed = offerSchema.safeParse(offer)
    if (!parsed.success) {
        throw new Error(parsed.error.issues[0].message)
    }

    const supabase = await createClient()
    const { id, ...fields } = parsed.data

    if (id) {
        const { data, error } = await supabase
            .from('lv_zinergia_tarifas')
            .update(fields)
            .eq('id', id)
            .select()
            .single()
        if (error) return actionError(error, 'Error al actualizar la tarifa')
        revalidatePath('/dashboard/tariffs')
        logAdminAction('update_offer', 'lv_zinergia_tarifas', id, { nombre: parsed.data.nombre }).catch(() => {})
        return actionSuccess(data as Offer)
    }

    const { data, error } = await supabase
        .from('lv_zinergia_tarifas')
        .insert(fields)
        .select()
        .single()
    if (error) return actionError(error, 'Error al crear la tarifa')
    revalidatePath('/dashboard/tariffs')
    logAdminAction('create_offer', 'lv_zinergia_tarifas', (data as { id: string }).id, { nombre: parsed.data.nombre }).catch(() => {})
    return actionSuccess(data as Offer)
}

export async function deleteOfferAction(id: string): Promise<ActionResult<void>> {
    await requireServerRole(['admin', 'franchise'])

    const parsedId = uuidSchema.safeParse(id)
    if (!parsedId.success) throw new Error('ID de oferta inválido')

    const supabase = await createClient()
    const { error } = await supabase.from('lv_zinergia_tarifas').delete().eq('id', parsedId.data)
    if (error) return actionError(error, 'Error al eliminar la tarifa')
    revalidatePath('/dashboard/tariffs')
    logAdminAction('delete_offer', 'lv_zinergia_tarifas', parsedId.data).catch(() => {})
    return actionSuccess(undefined)
}

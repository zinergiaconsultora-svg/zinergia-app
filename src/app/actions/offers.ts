'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import { Offer } from '@/types/crm'
import { ActionResult, actionError, actionSuccess } from './helpers'

export async function saveOfferAction(offer: Partial<Offer>): Promise<ActionResult<Offer>> {
    await requireServerRole(['admin', 'franchise'])
    const supabase = await createClient()

    if (offer.id) {
        const { data, error } = await supabase
            .from('lv_zinergia_tarifas')
            .update(offer)
            .eq('id', offer.id)
            .select()
            .single()
        if (error) return actionError(error, 'Error al actualizar la tarifa')
        revalidatePath('/dashboard/tariffs')
        return actionSuccess(data as Offer)
    }

    const { data, error } = await supabase
        .from('lv_zinergia_tarifas')
        .insert(offer)
        .select()
        .single()
    if (error) return actionError(error, 'Error al crear la tarifa')
    revalidatePath('/dashboard/tariffs')
    return actionSuccess(data as Offer)
}

export async function deleteOfferAction(id: string): Promise<ActionResult<void>> {
    await requireServerRole(['admin', 'franchise'])
    const supabase = await createClient()
    const { error } = await supabase.from('lv_zinergia_tarifas').delete().eq('id', id)
    if (error) return actionError(error, 'Error al eliminar la tarifa')
    revalidatePath('/dashboard/tariffs')
    return actionSuccess(undefined)
}

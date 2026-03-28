'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import { Offer } from '@/types/crm'

export async function saveOfferAction(offer: Partial<Offer>) {
    await requireServerRole(['admin', 'franchise'])

    const supabase = await createClient()

    if (offer.id) {
        const { data, error } = await supabase
            .from('lv_zinergia_tarifas')
            .update(offer)
            .eq('id', offer.id)
            .select()
            .single()
        if (error) throw error
        revalidatePath('/dashboard/tariffs')
        return data
    }

    const { data, error } = await supabase
        .from('lv_zinergia_tarifas')
        .insert(offer)
        .select()
        .single()
    if (error) throw error
    revalidatePath('/dashboard/tariffs')
    return data
}

export async function deleteOfferAction(id: string) {
    await requireServerRole(['admin', 'franchise'])

    const supabase = await createClient()
    const { error } = await supabase.from('lv_zinergia_tarifas').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/dashboard/tariffs')
}

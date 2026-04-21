'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import { offerSchema, uuidSchema } from '@/lib/validation/schemas'
import type { Offer } from '@/types/crm'

export async function saveOfferAction(offer: Partial<Offer>) {
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
        if (error) throw error
        revalidatePath('/dashboard/tariffs')
        return data
    }

    const { data, error } = await supabase
        .from('lv_zinergia_tarifas')
        .insert(fields)
        .select()
        .single()
    if (error) throw error
    revalidatePath('/dashboard/tariffs')
    return data
}

export async function deleteOfferAction(id: string) {
    await requireServerRole(['admin', 'franchise'])

    const parsedId = uuidSchema.safeParse(id)
    if (!parsedId.success) throw new Error('ID de oferta inválido')

    const supabase = await createClient()
    const { error } = await supabase.from('lv_zinergia_tarifas').delete().eq('id', parsedId.data)
    if (error) throw error
    revalidatePath('/dashboard/tariffs')
}

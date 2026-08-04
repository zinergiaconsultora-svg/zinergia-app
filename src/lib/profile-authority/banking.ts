import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const actorIdSchema = z.uuid();
const normalizedSpanishIbanSchema = z.string().regex(/^ES\d{22}$/);

export async function updateOwnIbanCommand(actorId: string, iban: string) {
    const trustedActorId = actorIdSchema.parse(actorId);
    const normalizedIban = normalizedSpanishIbanSchema.parse(iban);
    return createServiceClient().rpc('update_own_iban', {
        p_actor_id: trustedActorId,
        p_iban: normalizedIban,
    });
}

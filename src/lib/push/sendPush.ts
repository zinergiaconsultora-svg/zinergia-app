import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabase/service';

// Lazy VAPID init — no llamar a setVapidDetails en tiempo de módulo
// para evitar errores durante el build de Next.js
let _vapidReady = false;

function ensureVapid(): boolean {
    if (_vapidReady) return true;
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const sub = process.env.VAPID_SUBJECT;
    if (!pub || !priv || !sub) return false;
    try {
        webpush.setVapidDetails(sub, pub, priv);
        _vapidReady = true;
        return true;
    } catch (e) {
        console.warn('[Push] VAPID setup failed:', e);
        return false;
    }
}

export interface PushPayload {
    title: string;
    body: string;
    url?: string;
    icon?: string;
}

/**
 * Envía una Web Push a todos los dispositivos suscritos de un usuario.
 * No lanza si falla — siempre no-bloqueante.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!ensureVapid()) {
        console.warn('[Push] VAPID not configured — skipping push notification');
        return;
    }

    try {
        const supabaseAdmin = createServiceClient();

        const { data: subs } = await supabaseAdmin
            .from('push_subscriptions')
            .select('subscription_json')
            .eq('user_id', userId);

        if (!subs || subs.length === 0) return;

        const message = JSON.stringify(payload);

        await Promise.allSettled(
            subs.map(({ subscription_json }) =>
                webpush.sendNotification(subscription_json, message)
                    .catch((err: { statusCode?: number }) => {
                        // 410 = suscripción expirada — limpiar de la DB
                        if (err.statusCode === 410) {
                            supabaseAdmin
                                .from('push_subscriptions')
                                .delete()
                                .eq('endpoint', subscription_json.endpoint)
                                .then(() => {});
                        }
                    })
            )
        );
    } catch (e) {
        console.warn('[Push] sendPushToUser failed (non-blocking):', e);
    }
}

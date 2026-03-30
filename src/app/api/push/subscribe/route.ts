import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        const subscription = await request.json();
        if (!subscription?.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Upsert — un usuario puede tener varias suscripciones (distintos dispositivos)
        // endpoint es único por dispositivo/browser
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert(
                {
                    user_id: user.id,
                    endpoint: subscription.endpoint,
                    p256dh: subscription.keys?.p256dh,
                    auth: subscription.keys?.auth,
                    subscription_json: subscription,
                },
                { onConflict: 'endpoint' }
            );

        if (error) {
            console.error('[Push] Failed to save subscription:', error.message);
            return NextResponse.json({ error: 'DB error' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('[Push] Subscribe error:', e);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

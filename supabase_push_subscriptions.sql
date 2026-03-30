-- =============================================
-- Web Push Subscriptions
-- =============================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT,
    auth TEXT,
    subscription_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS handle_updated_at_push_subscriptions ON public.push_subscriptions;
CREATE TRIGGER handle_updated_at_push_subscriptions
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_own" ON public.push_subscriptions;
CREATE POLICY "push_subs_own" ON public.push_subscriptions
    FOR ALL USING (user_id = auth.uid());

-- Superadmin
DROP POLICY IF EXISTS "push_subs_admin" ON public.push_subscriptions;
CREATE POLICY "push_subs_admin" ON public.push_subscriptions
    FOR ALL USING (public.is_superadmin());

-- Índice para buscar por user_id rápido
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

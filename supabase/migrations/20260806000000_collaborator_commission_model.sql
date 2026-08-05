-- Comisión por colaborador: porcentaje propio con historial, y extra por operación.
--
-- El modelo pasa a ser un administrador y colaboradores. Cada colaborador tiene su
-- propio porcentaje, fijado al darlo de alta, y el administrador puede añadir un
-- extra en euros al convertir un lead en cliente.
--
-- Dos decisiones que gobiernan el diseño:
--
--   1. El porcentaje se puede cambiar, y el cambio mira hacia delante: lo que se
--      cierre a partir de esa fecha usa el nuevo. Por eso los porcentajes se
--      ACUMULAN con su fecha de entrada en vigor en lugar de sobrescribirse. Sin
--      historial, la pregunta "¿por qué esta operación pagó un 55 % si el perfil
--      dice 65 %?" no tiene respuesta.
--
--   2. El extra sale de una decisión manual sobre dinero, así que queda registrado
--      quién lo puso y cuándo. Las decisiones manuales sobre dinero son las que
--      alguien pide explicar meses después.
--
-- Nada de esto altera lo ya liquidado: el porcentaje se congela en la operación
-- cuando se cierra, igual que ya se hace con los precios de una propuesta.

BEGIN;

-- ── Historial de porcentajes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collaborator_commission_rates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- En puntos básicos para no arrastrar decimales: 6500 = 65 %.
    rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
    effective_from timestamptz NOT NULL DEFAULT now(),
    note text CHECK (note IS NULL OR length(note) <= 500),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.collaborator_commission_rates IS
    'Porcentaje de comisión de cada colaborador, acumulado por fecha de entrada en vigor. Se añade, nunca se corrige: cambiar el porcentaje no puede reescribir lo ya liquidado.';

CREATE INDEX IF NOT EXISTS idx_collaborator_rates_profile_effective
    ON public.collaborator_commission_rates (profile_id, effective_from DESC);

ALTER TABLE public.collaborator_commission_rates ENABLE ROW LEVEL SECURITY;

-- El colaborador ve el suyo y sólo el suyo. Ver el de otro es la misma fuga que se
-- cerró en la pestaña de red.
DROP POLICY IF EXISTS "Cada colaborador lee su propio porcentaje" ON public.collaborator_commission_rates;
CREATE POLICY "Cada colaborador lee su propio porcentaje"
    ON public.collaborator_commission_rates
    FOR SELECT
    TO authenticated
    USING (
        profile_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
        )
    );

-- Ninguna escritura desde el navegador: sólo por la función de abajo, que deja
-- rastro de quién y cuándo.
REVOKE INSERT, UPDATE, DELETE ON public.collaborator_commission_rates FROM authenticated, anon;
GRANT SELECT ON public.collaborator_commission_rates TO authenticated;

-- ── Fijar el porcentaje ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_collaborator_commission_rate(
    p_profile_id uuid,
    p_rate_bps integer,
    p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_new_id uuid;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'no autenticado' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_actor_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'solo la administracion fija comisiones' USING ERRCODE = '42501';
    END IF;

    IF p_rate_bps IS NULL OR p_rate_bps NOT BETWEEN 0 AND 10000 THEN
        RAISE EXCEPTION 'porcentaje fuera de rango' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id) THEN
        RAISE EXCEPTION 'el perfil no existe' USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.collaborator_commission_rates (profile_id, rate_bps, note, created_by)
    VALUES (p_profile_id, p_rate_bps, nullif(btrim(coalesce(p_note, '')), ''), v_actor_id)
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

-- ── Consultar el porcentaje vigente en un momento dado ────────────────────────

CREATE OR REPLACE FUNCTION public.get_collaborator_commission_rate(
    p_profile_id uuid,
    p_at timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT rate_bps
    FROM public.collaborator_commission_rates
    WHERE profile_id = p_profile_id
      AND effective_from <= p_at
    ORDER BY effective_from DESC, created_at DESC
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_collaborator_commission_rate(uuid, timestamptz) IS
    'Porcentaje vigente para ese colaborador en ese momento. NULL si nunca se le fijó uno: quien llame debe tratarlo como "sin configurar" y no como cero, que pagaría nada en silencio.';

-- ── Extra en euros sobre la operación ─────────────────────────────────────────

ALTER TABLE public.opportunities
    ADD COLUMN IF NOT EXISTS extra_commission_amount numeric(12, 2) NOT NULL DEFAULT 0
        CHECK (extra_commission_amount >= 0),
    ADD COLUMN IF NOT EXISTS extra_commission_reason text
        CHECK (extra_commission_reason IS NULL OR length(extra_commission_reason) <= 500),
    ADD COLUMN IF NOT EXISTS extra_commission_set_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS extra_commission_set_at timestamptz;

COMMENT ON COLUMN public.opportunities.extra_commission_amount IS
    'Euros que la administracion añade a la comision de esta operacion. Cero es lo normal.';

CREATE OR REPLACE FUNCTION public.set_opportunity_extra_commission(
    p_opportunity_id uuid,
    p_amount numeric,
    p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'no autenticado' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_actor_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'solo la administracion añade extras' USING ERRCODE = '42501';
    END IF;

    IF p_amount IS NULL OR p_amount < 0 OR p_amount > 100000 THEN
        RAISE EXCEPTION 'importe fuera de rango' USING ERRCODE = '22023';
    END IF;

    UPDATE public.opportunities
    SET extra_commission_amount = round(p_amount, 2),
        extra_commission_reason = nullif(btrim(coalesce(p_reason, '')), ''),
        extra_commission_set_by = v_actor_id,
        extra_commission_set_at = now(),
        updated_at = now()
    WHERE id = p_opportunity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'la operacion no existe' USING ERRCODE = '23503';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_collaborator_commission_rate(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_opportunity_extra_commission(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_collaborator_commission_rate(uuid, timestamptz) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_collaborator_commission_rate(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_opportunity_extra_commission(uuid, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_collaborator_commission_rate(uuid, timestamptz) TO authenticated, service_role;

COMMIT;

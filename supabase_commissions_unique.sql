-- ============================================================
-- MIGRACIÓN: Prevención de race conditions en comisiones
-- Ejecutar una vez en Supabase SQL Editor.
-- ============================================================

-- 1. Añadir restricción UNIQUE sobre proposal_id en network_commissions.
--    Si ya existe una comisión para la propuesta, cualquier INSERT concurrente
--    falla silenciosamente gracias al ON CONFLICT DO NOTHING del lado de la app.
--    Esta es la única garantía verdaderamente atómica.

ALTER TABLE network_commissions
  ADD CONSTRAINT IF NOT EXISTS network_commissions_proposal_id_key UNIQUE (proposal_id);

-- 2. Índice parcial de apoyo para la consulta de verificación previa (opcional,
--    la restricción UNIQUE ya crea un índice, este es redundante — se omite).

-- 3. Verificación: la siguiente query debe devolver 0 duplicados antes de migrar.
--    Ejecutar primero para confirmar integridad:
--
--    SELECT proposal_id, COUNT(*) AS cnt
--    FROM network_commissions
--    GROUP BY proposal_id
--    HAVING COUNT(*) > 1;
--
--    Si devuelve filas, deduplica antes con:
--    DELETE FROM network_commissions a
--    USING network_commissions b
--    WHERE a.created_at > b.created_at
--      AND a.proposal_id = b.proposal_id;

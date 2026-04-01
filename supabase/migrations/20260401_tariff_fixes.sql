-- =============================================================
-- MIGRATION: 20260401_tariff_fixes.sql
-- 1. UNIQUE index en tariff_commissions (evita duplicados)
-- 2. Borrar filas duplicadas si las hubiera (idempotente)
-- =============================================================

-- ─── 1. Eliminar duplicados conservando el registro más antiguo ───────────────

DELETE FROM tariff_commissions
WHERE id NOT IN (
    SELECT DISTINCT ON (
        company,
        COALESCE(modelo, ''),
        supply_type,
        tipo_cliente,
        COALESCE(producto_tipo, ''),
        consumption_min_mwh
    ) id
    FROM tariff_commissions
    ORDER BY
        company,
        COALESCE(modelo, ''),
        supply_type,
        tipo_cliente,
        COALESCE(producto_tipo, ''),
        consumption_min_mwh,
        created_at ASC
);

-- ─── 2. Crear índice único ────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS unique_tariff_commission
    ON tariff_commissions (
        company,
        COALESCE(modelo, ''),
        supply_type,
        tipo_cliente,
        COALESCE(producto_tipo, ''),
        consumption_min_mwh
    );

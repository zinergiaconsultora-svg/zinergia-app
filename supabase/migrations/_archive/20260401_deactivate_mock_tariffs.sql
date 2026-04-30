-- =============================================================
-- MIGRATION: 20260401_deactivate_mock_tariffs.sql
-- Desactiva las tarifas mock/placeholder originales (sin
-- codigo_producto) que existían antes de importar el Excel real.
-- Las tarifas nuevas del Excel tienen siempre codigo_producto.
-- =============================================================

UPDATE lv_zinergia_tarifas
SET    is_active = FALSE
WHERE  codigo_producto IS NULL;

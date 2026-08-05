-- La caché del SIPS caducaba a los 30 días.
--
-- Guarda el consumo anual de un punto de suministro. Un mes es demasiado: el
-- consumo de un cliente cambia, y una propuesta calculada sobre un dato de hace
-- treinta días se presenta como actual sin serlo. La especificación del SIPS
-- trabaja con una ventana de siete días, y esa es la que se adopta.
--
-- Además, `expires_at` se escribía pero nunca se leía: la lectura calculaba la
-- frescura restando días a `fetched_at` en la aplicación. Con dos fuentes para
-- la misma decisión, cambiar una y olvidar la otra era cuestión de tiempo. A
-- partir de aquí manda `expires_at`, y esta migración lo deja coherente para las
-- filas que ya existen.

BEGIN;

ALTER TABLE public.sips_consumption_cache
    ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- Las filas guardadas con la ventana de 30 días se recortan a siete desde su
-- propia fecha de consulta. Las que con ese criterio ya estaban caducadas quedan
-- caducadas, que es lo correcto: se volverán a pedir a la CNMC la próxima vez.
UPDATE public.sips_consumption_cache
SET expires_at = fetched_at + interval '7 days'
WHERE expires_at > fetched_at + interval '7 days';

COMMENT ON COLUMN public.sips_consumption_cache.expires_at IS
    'Momento a partir del cual la fila deja de servirse. Es la única fuente de verdad sobre la frescura de la caché; la aplicación no recalcula la ventana por su cuenta.';

COMMIT;

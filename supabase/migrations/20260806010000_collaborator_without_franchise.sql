-- Fase 1: un colaborador puede existir sin franquicia.
--
-- Hasta ahora la base de datos exigía que todo `agent` tuviera responsable Y
-- franquicia. Con el modelo nuevo —un administrador y colaboradores— la
-- franquicia deja de tener sentido, pero el responsable sigue haciendo falta:
-- es lo que dice de quién cuelga cada persona.
--
-- Lo que NO cambia, y es lo importante:
--
--   * El administrador sigue sin responsable y sin franquicia. Esa es la regla
--     que impide que la cuenta que gobierna la aplicación quede atrapada bajo
--     otra, y es exactamente el fallo que se encontró en producción en agosto.
--   * El rol `franchise` sigue siendo válido y sigue exigiendo ambas cosas. No
--     se rompe nada de lo que ya existe; sólo se deja de obligar a los
--     colaboradores nuevos.
--
-- Es decir: se relaja una exigencia, no se retira una garantía.

BEGIN;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_authority_tuple_check,
    ADD CONSTRAINT profiles_authority_tuple_check CHECK (
        -- Perfil recién creado, aún sin autoridad asignada.
        (role IS NULL AND parent_id IS NULL AND franchise_id IS NULL)
        -- La administración no cuelga de nadie. Invariante, no preferencia.
        OR (role = 'admin' AND parent_id IS NULL AND franchise_id IS NULL)
        -- La franquicia, mientras exista el rol, sigue necesitando las dos.
        OR (role = 'franchise' AND parent_id IS NOT NULL AND franchise_id IS NOT NULL)
        -- El colaborador necesita responsable. La franquicia pasa a ser opcional.
        OR (role = 'agent' AND parent_id IS NOT NULL)
    );

COMMENT ON CONSTRAINT profiles_authority_tuple_check ON public.profiles IS
    'Autoridad de cada perfil. La administracion nunca tiene responsable ni franquicia: es lo que impide perder el control de la aplicacion. El colaborador necesita responsable; la franquicia es opcional desde que el modelo dejo de tenerlas.';

COMMIT;

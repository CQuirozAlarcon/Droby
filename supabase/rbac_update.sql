-- ============================================================
-- RBAC CON CUSTOM ACCESS TOKEN HOOK (reemplaza el uso de app_metadata)
-- ============================================================

-- 1. Tabla que guarda el rol de cada usuario
CREATE TABLE public.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'empleado'))
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Solo el propio usuario puede ver su rol (lectura). La escritura se hace
-- manualmente desde el SQL Editor o Table Editor por el dueño del proyecto.
CREATE POLICY usuario_ve_su_rol ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- 2. Función que Supabase Auth ejecuta al generar cada JWT.
-- Lee el rol desde user_roles y lo mete como claim "user_role" en el token.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    claims jsonb;
    user_role text;
BEGIN
    SELECT role INTO user_role
    FROM public.user_roles
    WHERE user_id = (event->>'user_id')::uuid;

    claims := event->'claims';

    IF user_role IS NOT NULL THEN
        claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
    ELSE
        -- Si el usuario no tiene rol asignado, por defecto es 'empleado' (más restrictivo)
        claims := jsonb_set(claims, '{user_role}', '"empleado"');
    END IF;

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$;

-- 3. Permisos requeridos para que Supabase Auth pueda ejecutar la función
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

GRANT SELECT ON TABLE public.user_roles TO supabase_auth_admin;

-- ============================================================
-- ACTUALIZAR POLÍTICAS RLS: usar el nuevo claim "user_role" del JWT
-- en vez de "app_metadata ->> role"
-- ============================================================

DROP POLICY IF EXISTS admin_full_access_cajas ON cajas;
DROP POLICY IF EXISTS empleado_solo_lectura_cajas_empresa ON cajas;
DROP POLICY IF EXISTS admin_full_access_financiero ON movimientos_financieros;
DROP POLICY IF EXISTS empleado_ve_solo_empresa ON movimientos_financieros;
DROP POLICY IF EXISTS admin_full_access_adelantos ON adelantos;
DROP POLICY IF EXISTS admin_full_access_nomina ON nomina;

CREATE POLICY admin_full_access_cajas ON cajas
    FOR ALL USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY empleado_solo_lectura_cajas_empresa ON cajas
    FOR SELECT USING (
        (auth.jwt() ->> 'user_role') = 'empleado' AND tipo = 'empresa'
    );

CREATE POLICY admin_full_access_financiero ON movimientos_financieros
    FOR ALL USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY empleado_ve_solo_empresa ON movimientos_financieros
    FOR SELECT USING (
        (auth.jwt() ->> 'user_role') = 'empleado'
        AND caja_id = (SELECT id FROM cajas WHERE tipo = 'empresa')
    );

CREATE POLICY admin_full_access_adelantos ON adelantos
    FOR ALL USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY admin_full_access_nomina ON nomina
    FOR ALL USING ((auth.jwt() ->> 'user_role') = 'admin');

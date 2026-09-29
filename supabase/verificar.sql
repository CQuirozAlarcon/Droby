-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- Corre esto en el SQL Editor DESPUÉS de correr migration.sql.
-- Todas las filas deben decir 'OK'. Si alguna dice 'FALTA',
-- vuelve a correr supabase/migration.sql y revisa errores.
-- ============================================================

-- 1) Funciones RPC que la app necesita
SELECT
    fname AS funcion,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = fname
    ) THEN 'OK ✅' ELSE 'FALTA ❌' END AS estado
FROM (VALUES
    ('es_admin'),
    ('crear_venta'),
    ('cancelar_venta'),
    ('ajustar_stock'),
    ('registrar_movimiento_manual'),
    ('transferir_cajas'),
    ('crear_consignacion'),
    ('registrar_pago_consignacion'),
    ('generar_nomina_semanal'),
    ('marcar_nomina_pagada'),
    ('revertir_venta_cancelada')
) AS t(fname)
ORDER BY estado DESC, fname;

-- 2) Trigger de cancelación de venta
SELECT
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_venta_cancelada'
    ) THEN 'OK ✅' ELSE 'FALTA ❌' END AS trigger_cancelacion;

-- 3) Columna empleados.user_id (vínculo cuenta ↔ empleado)
SELECT
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'empleados' AND column_name = 'user_id'
    ) THEN 'OK ✅' ELSE 'FALTA ❌' END AS columna_user_id;

-- 4) Tu rol (debe decir 'admin' para TU cuenta)
SELECT u.email, COALESCE(r.role, 'empleado (sin fila en user_roles)') AS rol
FROM auth.users u
LEFT JOIN user_roles r ON r.user_id = u.id
ORDER BY u.created_at;

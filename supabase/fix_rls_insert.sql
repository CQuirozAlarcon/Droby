-- ============================================================
-- FIX: RLS bloqueaba INSERT (ej. "new row violates row-level
-- security policy for table productos"). Causa: las políticas
-- FOR ALL solo tenían USING, sin WITH CHECK explícito, que es
-- lo que Postgres evalúa específicamente para filas NUEVAS
-- (INSERT/UPDATE). Se re-crean todas con ambas cláusulas.
-- ============================================================

DROP POLICY IF EXISTS autenticados_acceso_productos ON productos;
CREATE POLICY autenticados_acceso_productos ON productos
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS autenticados_acceso_mov_inv ON movimientos_inventario;
CREATE POLICY autenticados_acceso_mov_inv ON movimientos_inventario
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS autenticados_acceso_clientes ON clientes;
CREATE POLICY autenticados_acceso_clientes ON clientes
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS autenticados_acceso_ventas ON ventas;
CREATE POLICY autenticados_acceso_ventas ON ventas
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS autenticados_acceso_venta_items ON venta_items;
CREATE POLICY autenticados_acceso_venta_items ON venta_items
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS autenticados_acceso_consig ON consignaciones;
CREATE POLICY autenticados_acceso_consig ON consignaciones
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS autenticados_acceso_consig_items ON consignacion_items;
CREATE POLICY autenticados_acceso_consig_items ON consignacion_items
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS autenticados_acceso_empleados ON empleados;
CREATE POLICY autenticados_acceso_empleados ON empleados
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS autenticados_acceso_asistencia ON asistencia;
CREATE POLICY autenticados_acceso_asistencia ON asistencia
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS admin_full_access_cajas ON cajas;
CREATE POLICY admin_full_access_cajas ON cajas
    FOR ALL USING ((auth.jwt() ->> 'user_role') = 'admin') WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

DROP POLICY IF EXISTS admin_full_access_financiero ON movimientos_financieros;
CREATE POLICY admin_full_access_financiero ON movimientos_financieros
    FOR ALL USING ((auth.jwt() ->> 'user_role') = 'admin') WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

DROP POLICY IF EXISTS admin_full_access_adelantos ON adelantos;
CREATE POLICY admin_full_access_adelantos ON adelantos
    FOR ALL USING ((auth.jwt() ->> 'user_role') = 'admin') WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

DROP POLICY IF EXISTS admin_full_access_nomina ON nomina;
CREATE POLICY admin_full_access_nomina ON nomina
    FOR ALL USING ((auth.jwt() ->> 'user_role') = 'admin') WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

-- ============================================================
-- Diagnóstico: si un empleado creado en Table Editor no aparece
-- en la app, casi siempre es porque la columna "activo" quedó en
-- NULL en vez de TRUE (la app solo lista activo = true). Revisa:
--   SELECT id, nombre, activo FROM empleados;
-- Y corrige con:
--   UPDATE empleados SET activo = true WHERE activo IS NULL;
-- ============================================================

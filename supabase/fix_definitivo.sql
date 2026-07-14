-- ============================================================
-- FIX DEFINITIVO Y CONSOLIDADO — correr esto una sola vez.
-- Reemplaza y deja obsoletos: rbac_update.sql y fix_rls_insert.sql
-- ============================================================

-- ------------------------------------------------------------
-- PARTE 1: Las políticas de administrador ya NO dependen del
-- Auth Hook / claim del JWT. Ahora consultan directamente la
-- tabla user_roles con auth.uid(). Esto es más robusto porque
-- no depende de un toggle manual en el Dashboard que es fácil
-- de olvidar activar (y que, si no está activo, deja a TODOS
-- los usuarios sin rol, incluso al admin).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS admin_full_access_cajas ON cajas;
DROP POLICY IF EXISTS empleado_solo_lectura_cajas_empresa ON cajas;
CREATE POLICY admin_full_access_cajas ON cajas
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY empleado_solo_lectura_cajas_empresa ON cajas
    FOR SELECT USING (
        tipo = 'empresa'
        AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS admin_full_access_financiero ON movimientos_financieros;
DROP POLICY IF EXISTS empleado_ve_solo_empresa ON movimientos_financieros;
CREATE POLICY admin_full_access_financiero ON movimientos_financieros
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY empleado_ve_solo_empresa ON movimientos_financieros
    FOR SELECT USING (
        caja_id = (SELECT id FROM cajas WHERE tipo = 'empresa')
        AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS admin_full_access_adelantos ON adelantos;
CREATE POLICY admin_full_access_adelantos ON adelantos
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS admin_full_access_nomina ON nomina;
CREATE POLICY admin_full_access_nomina ON nomina
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ------------------------------------------------------------
-- PARTE 2: Tablas operativas abiertas a cualquier autenticado,
-- con WITH CHECK explícito (requerido para que INSERT funcione).
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- PARTE 3 (la causa raíz de "ventas" y "adelantos" fallando):
-- Los triggers que escriben en movimientos_financieros/cajas/
-- movimientos_inventario corrían con el mismo permiso del
-- usuario que disparó la acción. Si un empleado (no admin)
-- registraba una venta, el trigger intentaba escribir en
-- movimientos_financieros (restringida a admin) y todo el
-- INSERT fallaba. SECURITY DEFINER hace que estas funciones
-- corran con privilegios del dueño de la función (que en
-- Supabase no está sujeto a RLS), evitando el choque.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION procesar_venta_item()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE productos SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.producto_id;

    INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, referencia_id)
    VALUES (NEW.producto_id, 'venta', NEW.cantidad, NEW.venta_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION procesar_venta_financiero()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caja_id_target INT;
BEGIN
    SELECT id INTO caja_id_target FROM cajas WHERE tipo = NEW.caja_destino;

    INSERT INTO movimientos_financieros (caja_id, tipo, monto, categoria, referencia_id, descripcion)
    VALUES (caja_id_target, 'ingreso', NEW.total, 'venta', NEW.id, 'Venta #' || NEW.id);

    UPDATE cajas SET saldo_actual = saldo_actual + NEW.total WHERE id = caja_id_target;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION procesar_adelanto_financiero()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caja_id INT;
BEGIN
    SELECT id INTO v_caja_id FROM cajas WHERE tipo = 'empresa';

    INSERT INTO movimientos_financieros (caja_id, tipo, monto, categoria, referencia_id, descripcion)
    VALUES (v_caja_id, 'egreso', NEW.monto, 'adelanto', NEW.id, 'Adelanto empleado #' || NEW.empleado_id);

    UPDATE cajas SET saldo_actual = saldo_actual - NEW.monto WHERE id = v_caja_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION procesar_nomina_pagada()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caja_id INT;
BEGIN
    IF NEW.pagado = true AND OLD.pagado = false THEN
        SELECT id INTO v_caja_id FROM cajas WHERE tipo = 'empresa';

        INSERT INTO movimientos_financieros (caja_id, tipo, monto, categoria, referencia_id, descripcion)
        VALUES (v_caja_id, 'egreso', NEW.total_pagar, 'nomina', NEW.id, 'Nómina empleado #' || NEW.empleado_id || ' semana ' || NEW.semana_inicio);

        UPDATE cajas SET saldo_actual = saldo_actual - NEW.total_pagar WHERE id = v_caja_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generar_nomina_semanal(
    p_empleado_id INT,
    p_semana_inicio DATE
) RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_semana_fin DATE := p_semana_inicio + INTERVAL '6 days';
    v_horas NUMERIC;
    v_salario_hora NUMERIC;
    v_monto_bruto NUMERIC;
    v_total_adelantos NUMERIC;
    v_nomina_id INT;
BEGIN
    SELECT salario_hora INTO v_salario_hora FROM empleados WHERE id = p_empleado_id;
    IF v_salario_hora IS NULL THEN
        RAISE EXCEPTION 'Empleado % no existe', p_empleado_id;
    END IF;

    v_horas := calcular_horas_semana(p_empleado_id, p_semana_inicio, v_semana_fin);
    v_monto_bruto := ROUND(v_horas * v_salario_hora, 2);

    SELECT COALESCE(SUM(monto), 0) INTO v_total_adelantos
    FROM adelantos
    WHERE empleado_id = p_empleado_id
      AND descontado = false
      AND fecha <= v_semana_fin;

    INSERT INTO nomina (empleado_id, semana_inicio, semana_fin, horas_trabajadas, monto_bruto, total_adelantos, total_pagar)
    VALUES (p_empleado_id, p_semana_inicio, v_semana_fin, v_horas, v_monto_bruto, v_total_adelantos, v_monto_bruto - v_total_adelantos)
    RETURNING id INTO v_nomina_id;

    UPDATE adelantos
    SET descontado = true, nomina_id = v_nomina_id
    WHERE empleado_id = p_empleado_id
      AND descontado = false
      AND fecha <= v_semana_fin;

    RETURN v_nomina_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- PARTE 4: verifica que tu usuario admin sí tenga fila en
-- user_roles (reemplaza el correo). Esto es lo único que
-- realmente controla quién es admin ahora.
-- ------------------------------------------------------------
-- SELECT u.email, r.role FROM auth.users u LEFT JOIN public.user_roles r ON r.user_id = u.id;
--
-- Si tu admin no aparece con role='admin', corre:
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = 'tu-correo@ejemplo.com'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

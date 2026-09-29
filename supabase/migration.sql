-- ============================================================
-- ERP ACCESORIOS — MIGRACIÓN NO DESTRUCTIVA (v1 → v2)
-- Corre esto en el SQL Editor de Supabase SI YA TENÍAS el schema.sql
-- original corriendo. NO borra datos: solo agrega constraints,
-- funciones, triggers y RPCs nuevos.
--
-- Es idempotente: puedes correrlo más de una vez sin que falle.
--
-- NOTA: el índice único de productos fallará si tienes filas
-- duplicadas (mismo tipo+modelo+variante). Si eso pasa, elimina
-- los duplicados a mano y vuelve a correr este script.
-- ============================================================

-- ------------------------------------------------------------
-- 1) HELPER: es_admin() — verificación de rol reutilizable
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------
-- 2) CONSTRAINTS DE INVENTARIO
-- ------------------------------------------------------------
-- Stock nunca negativo. NOT VALID = no revisa filas viejas, pero
-- sí bloquea escrituras nuevas que lo violen.
ALTER TABLE productos
    ADD CONSTRAINT stock_no_negativo CHECK (stock_actual >= 0) NOT VALID;

-- El UNIQUE(tipo, modelo, variante) original admitía fundas duplicadas
-- (NULL en variante se considera distinto). Lo reemplazamos por un
-- índice único que trata NULL como ''.
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_tipo_modelo_variante_key;
CREATE UNIQUE INDEX IF NOT EXISTS productos_tipo_modelo_variante_unico
    ON productos (tipo, modelo, COALESCE(variante, ''));

-- ------------------------------------------------------------
-- 3) VÍNCULO USUARIO ↔ EMPLEADO (para "marcar MI entrada")
-- Después de correr este script, vincula cada cuenta así:
--   UPDATE empleados SET user_id = (SELECT id FROM auth.users WHERE email = 'correo@ejemplo.com')
--   WHERE nombre = 'Nombre del Empleado';
-- ------------------------------------------------------------
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS empleados_user_id_idx ON empleados(user_id);

-- ------------------------------------------------------------
-- 4) REALTIME: publicar cambios de productos (sin esto la
-- suscripción de la app nunca recibía eventos)
-- ------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE productos;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- ya estaba publicada
END $$;

-- ------------------------------------------------------------
-- 5) TRIGGER: revertir stock y dinero al cancelar una venta
-- (antes cancelar solo cambiaba el estado: la plata quedaba en
-- caja y el stock descontado para siempre)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION revertir_venta_cancelada()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    item RECORD;
    v_caja_id INT;
    v_nombre_cliente TEXT;
BEGIN
    IF OLD.estado = 'completada' AND NEW.estado = 'cancelada' THEN
        FOR item IN SELECT * FROM venta_items WHERE venta_id = NEW.id LOOP
            UPDATE productos SET stock_actual = stock_actual + item.cantidad WHERE id = item.producto_id;
            INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, referencia_id, nota)
            VALUES (item.producto_id, 'entrada', item.cantidad, NEW.id,
                    'Reversión por cancelación de venta #' || NEW.id);
        END LOOP;

        SELECT id INTO v_caja_id FROM cajas WHERE tipo = NEW.caja_destino;
        SELECT nombre INTO v_nombre_cliente FROM clientes WHERE id = NEW.cliente_id;
        INSERT INTO movimientos_financieros (caja_id, tipo, monto, categoria, referencia_id, descripcion)
        VALUES (v_caja_id, 'egreso', NEW.total, 'venta_cancelada', NEW.id,
                'Reversión de venta cancelada — ' || COALESCE(v_nombre_cliente, 'cliente #' || NEW.cliente_id));
        UPDATE cajas SET saldo_actual = saldo_actual - NEW.total WHERE id = v_caja_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venta_cancelada ON ventas;
CREATE TRIGGER trg_venta_cancelada AFTER UPDATE OF estado ON ventas
FOR EACH ROW EXECUTE FUNCTION revertir_venta_cancelada();

-- ------------------------------------------------------------
-- 6) RPC TRANSACCIONAL: crear_venta
-- Valida stock con bloqueo de filas, calcula el total en servidor
-- e inserta venta + items en UNA transacción (los triggers de
-- stock/caja se disparan dentro; si algo falla, todo se revierte).
-- p_items: '[{"producto_id":1,"cantidad":2,"precio_unitario":10.5}]'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_venta(
    p_cliente_id INT,
    p_items JSONB,
    p_caja_destino VARCHAR(20) DEFAULT 'empresa'
) RETURNS INT
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_venta_id INT;
    v_total NUMERIC := 0;
    item JSONB;
    v_stock INT;
    v_modelo TEXT;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La venta necesita al menos un producto';
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        SELECT stock_actual, modelo INTO v_stock, v_modelo
        FROM productos WHERE id = (item->>'producto_id')::INT FOR UPDATE;
        IF v_stock IS NULL THEN
            RAISE EXCEPTION 'Producto % no existe', item->>'producto_id';
        END IF;
        IF v_stock < (item->>'cantidad')::INT THEN
            RAISE EXCEPTION 'Stock insuficiente de %: hay %, se pidieron %',
                v_modelo, v_stock, (item->>'cantidad')::INT;
        END IF;
        v_total := v_total + (item->>'cantidad')::INT * (item->>'precio_unitario')::NUMERIC;
    END LOOP;

    INSERT INTO ventas (cliente_id, total, caja_destino, estado)
    VALUES (p_cliente_id, v_total, p_caja_destino, 'completada')
    RETURNING id INTO v_venta_id;

    INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario)
    SELECT v_venta_id, (i->>'producto_id')::INT, (i->>'cantidad')::INT, (i->>'precio_unitario')::NUMERIC
    FROM jsonb_array_elements(p_items) i;

    RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 7) RPC: cancelar_venta (la reversión la hace el trigger del paso 5)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancelar_venta(p_venta_id INT)
RETURNS VOID
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_estado VARCHAR(20);
BEGIN
    SELECT estado INTO v_estado FROM ventas WHERE id = p_venta_id FOR UPDATE;
    IF v_estado IS NULL THEN
        RAISE EXCEPTION 'Venta % no existe', p_venta_id;
    END IF;
    IF v_estado <> 'completada' THEN
        RAISE EXCEPTION 'Solo se pueden cancelar ventas completadas (estado actual: %)', v_estado;
    END IF;
    UPDATE ventas SET estado = 'cancelada' WHERE id = p_venta_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 8) RPC: ajustar_stock — UPDATE relativo atómico (adiós a la
-- race condition de leer stock en el cliente y reescribirlo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ajustar_stock(
    p_producto_id INT,
    p_cantidad INT,
    p_nota TEXT,
    p_operador_id INT DEFAULT NULL
) RETURNS INT
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_nuevo INT;
BEGIN
    UPDATE productos SET stock_actual = stock_actual + p_cantidad
    WHERE id = p_producto_id
    RETURNING stock_actual INTO v_nuevo;

    IF v_nuevo IS NULL THEN
        RAISE EXCEPTION 'Producto % no existe', p_producto_id;
    END IF;
    IF v_nuevo < 0 THEN
        RAISE EXCEPTION 'El ajuste dejaría el stock en negativo (%)', v_nuevo;
    END IF;

    INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, nota, operador_id)
    VALUES (p_producto_id, CASE WHEN p_cantidad >= 0 THEN 'entrada' ELSE 'salida' END,
            ABS(p_cantidad), p_nota, p_operador_id);

    RETURN v_nuevo;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 9) RPC: registrar_movimiento_manual (admin, transaccional)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_movimiento_manual(
    p_caja_tipo VARCHAR(20),
    p_tipo VARCHAR(20),
    p_monto NUMERIC,
    p_categoria TEXT,
    p_descripcion TEXT
) RETURNS VOID
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_caja_id INT;
BEGIN
    IF NOT es_admin() THEN
        RAISE EXCEPTION 'Solo los administradores pueden registrar movimientos manuales';
    END IF;
    IF p_monto IS NULL OR p_monto <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a 0';
    END IF;
    IF p_tipo NOT IN ('ingreso', 'egreso') THEN
        RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_tipo;
    END IF;

    SELECT id INTO v_caja_id FROM cajas WHERE tipo = p_caja_tipo FOR UPDATE;
    IF v_caja_id IS NULL THEN
        RAISE EXCEPTION 'Caja % no encontrada', p_caja_tipo;
    END IF;

    INSERT INTO movimientos_financieros (caja_id, tipo, monto, categoria, descripcion)
    VALUES (v_caja_id, p_tipo, p_monto, p_categoria, p_descripcion);

    UPDATE cajas SET saldo_actual = saldo_actual + CASE WHEN p_tipo = 'ingreso' THEN p_monto ELSE -p_monto END
    WHERE id = v_caja_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 10) RPC: transferir_cajas (admin, transaccional, valida saldo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION transferir_cajas(
    p_origen VARCHAR(20),
    p_destino VARCHAR(20),
    p_monto NUMERIC,
    p_descripcion TEXT
) RETURNS VOID
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_origen_id INT;
    v_destino_id INT;
    v_saldo_origen NUMERIC;
BEGIN
    IF NOT es_admin() THEN
        RAISE EXCEPTION 'Solo los administradores pueden transferir entre cajas';
    END IF;
    IF p_origen = p_destino THEN
        RAISE EXCEPTION 'Origen y destino no pueden ser iguales';
    END IF;
    IF p_monto IS NULL OR p_monto <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a 0';
    END IF;

    SELECT id, saldo_actual INTO v_origen_id, v_saldo_origen FROM cajas WHERE tipo = p_origen FOR UPDATE;
    SELECT id INTO v_destino_id FROM cajas WHERE tipo = p_destino FOR UPDATE;
    IF v_origen_id IS NULL OR v_destino_id IS NULL THEN
        RAISE EXCEPTION 'Caja no encontrada';
    END IF;
    IF v_saldo_origen < p_monto THEN
        RAISE EXCEPTION 'Saldo insuficiente en caja % (S/ %)', p_origen, v_saldo_origen;
    END IF;

    INSERT INTO movimientos_financieros (caja_id, tipo, monto, categoria, descripcion) VALUES
        (v_origen_id, 'transferencia_interna', p_monto, 'transferencia_a_' || p_destino, p_descripcion),
        (v_destino_id, 'transferencia_interna', p_monto, 'transferencia_desde_' || p_origen, p_descripcion);

    UPDATE cajas SET saldo_actual = saldo_actual - p_monto WHERE id = v_origen_id;
    UPDATE cajas SET saldo_actual = saldo_actual + p_monto WHERE id = v_destino_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 11) RPC: crear_consignacion (mismo patrón transaccional)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_consignacion(
    p_cliente_id INT,
    p_items JSONB,
    p_fecha_limite DATE DEFAULT NULL,
    p_caja_destino VARCHAR(20) DEFAULT 'empresa'
) RETURNS INT
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_consignacion_id INT;
    item JSONB;
    v_stock INT;
    v_modelo TEXT;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La consignación necesita al menos un producto';
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        SELECT stock_actual, modelo INTO v_stock, v_modelo
        FROM productos WHERE id = (item->>'producto_id')::INT FOR UPDATE;
        IF v_stock IS NULL THEN
            RAISE EXCEPTION 'Producto % no existe', item->>'producto_id';
        END IF;
        IF v_stock < (item->>'cantidad')::INT THEN
            RAISE EXCEPTION 'Stock insuficiente de %: hay %, se pidieron %',
                v_modelo, v_stock, (item->>'cantidad')::INT;
        END IF;
    END LOOP;

    INSERT INTO consignaciones (cliente_id, fecha_limite, caja_destino, monto_total)
    VALUES (p_cliente_id, p_fecha_limite, p_caja_destino, 0)
    RETURNING id INTO v_consignacion_id;

    INSERT INTO consignacion_items (consignacion_id, producto_id, cantidad, precio_unitario)
    SELECT v_consignacion_id, (i->>'producto_id')::INT, (i->>'cantidad')::INT, (i->>'precio_unitario')::NUMERIC
    FROM jsonb_array_elements(p_items) i;

    RETURN v_consignacion_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 12) RPC: registrar_pago_consignacion — valida que el pago no
-- exceda el saldo pendiente (antes se podía sobrepagar y dejar
-- el saldo en negativo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_pago_consignacion(
    p_consignacion_id INT,
    p_monto NUMERIC,
    p_nota TEXT DEFAULT NULL
) RETURNS VOID
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_saldo NUMERIC;
BEGIN
    IF p_monto IS NULL OR p_monto <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser mayor a 0';
    END IF;

    SELECT saldo_pendiente INTO v_saldo FROM consignaciones WHERE id = p_consignacion_id FOR UPDATE;
    IF v_saldo IS NULL THEN
        RAISE EXCEPTION 'Consignación % no existe', p_consignacion_id;
    END IF;
    IF p_monto > v_saldo + 0.001 THEN
        RAISE EXCEPTION 'El pago (S/ %) excede el saldo pendiente (S/ %)', p_monto, v_saldo;
    END IF;

    INSERT INTO consignacion_pagos (consignacion_id, monto, nota)
    VALUES (p_consignacion_id, p_monto, p_nota);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 13) generar_nomina_semanal: ahora exige rol admin y da un
-- mensaje claro si la semana ya fue generada
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION generar_nomina_semanal(
    p_empleado_id INT, p_semana_inicio DATE
) RETURNS INT
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_semana_fin DATE := p_semana_inicio + INTERVAL '6 days';
    v_horas NUMERIC;
    v_salario_hora NUMERIC;
    v_monto_bruto NUMERIC;
    v_total_adelantos NUMERIC;
    v_nomina_id INT;
BEGIN
    IF NOT es_admin() THEN
        RAISE EXCEPTION 'Solo los administradores pueden generar nóminas';
    END IF;

    SELECT salario_hora INTO v_salario_hora FROM empleados WHERE id = p_empleado_id;
    IF v_salario_hora IS NULL THEN
        RAISE EXCEPTION 'Empleado % no existe', p_empleado_id;
    END IF;

    IF EXISTS (SELECT 1 FROM nomina WHERE empleado_id = p_empleado_id AND semana_inicio = p_semana_inicio) THEN
        RAISE EXCEPTION 'Ya existe una nómina de este empleado para la semana del %', p_semana_inicio;
    END IF;

    v_horas := calcular_horas_semana(p_empleado_id, p_semana_inicio, v_semana_fin);
    v_monto_bruto := ROUND(v_horas * v_salario_hora, 2);

    SELECT COALESCE(SUM(monto), 0) INTO v_total_adelantos
    FROM adelantos WHERE empleado_id = p_empleado_id AND descontado = false AND fecha <= v_semana_fin;

    INSERT INTO nomina (empleado_id, semana_inicio, semana_fin, horas_trabajadas, monto_bruto, total_adelantos, total_pagar)
    VALUES (p_empleado_id, p_semana_inicio, v_semana_fin, v_horas, v_monto_bruto, v_total_adelantos, v_monto_bruto - v_total_adelantos)
    RETURNING id INTO v_nomina_id;

    UPDATE adelantos SET descontado = true, nomina_id = v_nomina_id
    WHERE empleado_id = p_empleado_id AND descontado = false AND fecha <= v_semana_fin;

    RETURN v_nomina_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 14) RPC: marcar_nomina_pagada (admin) — antes el UPDATE por
-- RLS afectaba 0 filas sin error para no-admins
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION marcar_nomina_pagada(p_nomina_id INT)
RETURNS VOID
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NOT es_admin() THEN
        RAISE EXCEPTION 'Solo los administradores pueden marcar nóminas como pagadas';
    END IF;
    UPDATE nomina SET pagado = true WHERE id = p_nomina_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nómina % no existe', p_nomina_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 15) CLIENTES: columna documento (RUC o DNI, opcional)
--     Útil para identificar al cliente y (a futuro) generar facturas.
--     Se guarda tal cual: no se valida formato para no bloquear a
--     clientes con documentos atípicos.
-- ------------------------------------------------------------
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS documento VARCHAR(20);

-- ============================================================
-- 16) RPC: resumen_financiero — agregado para "Resumen de ganancias"
--     en la pantalla de Finanzas. Una sola consulta en lugar de traer
--     todas las ventas + items + movimientos al cliente.
--     Devuelve:
--       ventas_brutas, costo_productos_vendidos,
--       ingresos_consignaciones, otros_ingresos,
--       egresos_gasto_manual, egresos_adelanto,
--       egresos_nomina, egresos_venta_cancelada
-- ============================================================
CREATE OR REPLACE FUNCTION resumen_financiero()
RETURNS JSONB
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ventas_brutas NUMERIC := 0;
  v_costo_productos NUMERIC := 0;
  v_ingresos_consignaciones NUMERIC := 0;
  v_otros_ingresos NUMERIC := 0;
  v_egresos_gasto_manual NUMERIC := 0;
  v_egresos_compra_inventario NUMERIC := 0;
  v_egresos_adelanto NUMERIC := 0;
  v_egresos_nomina NUMERIC := 0;
  v_egresos_venta_cancelada NUMERIC := 0;
  v_valor_inventario NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(total), 0) INTO v_ventas_brutas
  FROM ventas WHERE estado = 'completada';

  SELECT COALESCE(SUM(vi.cantidad * p.costo_unitario), 0) INTO v_costo_productos
  FROM venta_items vi
  JOIN productos p ON p.id = vi.producto_id
  JOIN ventas v ON v.id = vi.venta_id
  WHERE v.estado = 'completada';

  SELECT
    COALESCE(SUM(CASE WHEN categoria = 'consignacion_pago' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN categoria = 'ingreso_extra' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN categoria = 'gasto_manual' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN categoria = 'compra_inventario' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN categoria = 'adelanto' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN categoria = 'nomina' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN categoria = 'venta_cancelada' THEN monto ELSE 0 END), 0)
  INTO v_ingresos_consignaciones, v_otros_ingresos, v_egresos_gasto_manual, v_egresos_compra_inventario, v_egresos_adelanto, v_egresos_nomina, v_egresos_venta_cancelada
  FROM movimientos_financieros
  WHERE tipo IN ('ingreso', 'egreso');

  -- Valor del inventario actual a costo: el dinero que está "guardado"
  -- en mercadería. Sirve para compensar visualmente un saldo de caja
  -- negativo tras una compra grande de stock.
  SELECT COALESCE(SUM(stock_actual * costo_unitario), 0) INTO v_valor_inventario
  FROM productos;

  RETURN jsonb_build_object(
    'ventas_brutas', v_ventas_brutas,
    'costo_productos_vendidos', v_costo_productos,
    'ingresos_consignaciones', v_ingresos_consignaciones,
    'otros_ingresos', v_otros_ingresos,
    'egresos_gasto_manual', v_egresos_gasto_manual,
    'egresos_compra_inventario', v_egresos_compra_inventario,
    'egresos_adelanto', v_egresos_adelanto,
    'egresos_nomina', v_egresos_nomina,
    'egresos_venta_cancelada', v_egresos_venta_cancelada,
    'valor_inventario', v_valor_inventario
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RECORDATORIOS POST-MIGRACIÓN (correr aparte, reemplazando datos):
--
-- a) Asignarte como admin (si no lo hiciste antes):
-- INSERT INTO user_roles (user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = 'tu-correo@ejemplo.com'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
--
-- b) Vincular tu cuenta con tu ficha de empleado (para que
--    "marcar mi entrada" desde el chat registre TU asistencia):
-- UPDATE empleados SET user_id = (SELECT id FROM auth.users WHERE email = 'tu-correo@ejemplo.com')
-- WHERE nombre = 'Tu Nombre Exacto';
-- ============================================================

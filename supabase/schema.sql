-- ============================================================
-- ERP ACCESORIOS — ESQUEMA COMPLETO (DROP + CREATE)
-- Corre esto UNA sola vez en el SQL Editor de Supabase. Reemplaza
-- por completo cualquier esquema anterior (elimina y vuelve a crear
-- todas las tablas, funciones, triggers y políticas RLS).
-- ============================================================

-- ------------------------------------------------------------
-- PARTE 0: LIMPIEZA TOTAL
-- ------------------------------------------------------------
DROP TABLE IF EXISTS consignacion_pagos CASCADE;
DROP TABLE IF EXISTS consignacion_items CASCADE;
DROP TABLE IF EXISTS consignaciones CASCADE;
DROP TABLE IF EXISTS venta_items CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS movimientos_financieros CASCADE;
DROP TABLE IF EXISTS cajas CASCADE;
DROP TABLE IF EXISTS nomina CASCADE;
DROP TABLE IF EXISTS adelantos CASCADE;
DROP TABLE IF EXISTS asistencia CASCADE;
DROP TABLE IF EXISTS movimientos_inventario CASCADE;
DROP TABLE IF EXISTS empleados CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;

DROP FUNCTION IF EXISTS procesar_venta_item() CASCADE;
DROP FUNCTION IF EXISTS procesar_venta_financiero() CASCADE;
DROP FUNCTION IF EXISTS revertir_venta_cancelada() CASCADE;
DROP FUNCTION IF EXISTS procesar_adelanto_financiero() CASCADE;
DROP FUNCTION IF EXISTS procesar_nomina_pagada() CASCADE;
DROP FUNCTION IF EXISTS procesar_consignacion_item() CASCADE;
DROP FUNCTION IF EXISTS procesar_consignacion_pago() CASCADE;
DROP FUNCTION IF EXISTS calcular_horas_semana(INT, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS generar_nomina_semanal(INT, DATE) CASCADE;
DROP FUNCTION IF EXISTS es_admin() CASCADE;
DROP FUNCTION IF EXISTS crear_venta(INT, JSONB, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS cancelar_venta(INT) CASCADE;
DROP FUNCTION IF EXISTS ajustar_stock(INT, INT, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS registrar_movimiento_manual(VARCHAR, VARCHAR, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS transferir_cajas(VARCHAR, VARCHAR, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS crear_consignacion(INT, JSONB, DATE, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS registrar_pago_consignacion(INT, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS marcar_nomina_pagada(INT) CASCADE;
DROP FUNCTION IF EXISTS resumen_financiero() CASCADE;

-- ------------------------------------------------------------
-- PARTE 1: ROLES DE USUARIO
-- ------------------------------------------------------------
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'empleado'))
);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY usuario_ve_su_rol ON user_roles FOR SELECT USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- PARTE 2: INVENTARIO
-- ------------------------------------------------------------
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('funda', 'cargador')),
    modelo VARCHAR(50) NOT NULL,
    variante VARCHAR(100),
    stock_actual INT NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo INT DEFAULT 10,
    precio_unitario NUMERIC(10,2) NOT NULL,
    costo_unitario NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Único por (tipo, modelo, variante) tratando variante NULL como '': un
-- UNIQUE normal admite duplicados cuando variante es NULL (fundas).
CREATE UNIQUE INDEX productos_tipo_modelo_variante_unico
    ON productos (tipo, modelo, COALESCE(variante, ''));

-- ------------------------------------------------------------
-- PARTE 3: RRHH (empleados primero, referenciado por movimientos_inventario)
-- ------------------------------------------------------------
CREATE TABLE empleados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    salario_hora NUMERIC(10,2) NOT NULL,
    activo BOOLEAN DEFAULT true,
    -- vínculo opcional con la cuenta de la app: permite que "marcar MI
    -- entrada" desde el chat registre la asistencia del usuario logueado
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX empleados_user_id_idx ON empleados(user_id);

CREATE TABLE movimientos_inventario (
    id SERIAL PRIMARY KEY,
    producto_id INT REFERENCES productos(id),
    tipo_movimiento VARCHAR(20) CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste', 'venta', 'consignacion')),
    cantidad INT NOT NULL,
    referencia_id INT,
    nota TEXT,
    operador_id INT REFERENCES empleados(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- PARTE 4: CLIENTES
-- ------------------------------------------------------------
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    tipo_cliente VARCHAR(20) DEFAULT 'mayorista' CHECK (tipo_cliente IN ('mayorista', 'minorista', 'vendedor')),
    telefono VARCHAR(20),
    -- RUC o DNI (opcional): se guarda tal cual; útil para facturación futura.
    -- No se valida el formato para no bloquear clientes con datos atípicos;
    -- la validación, si hace falta, queda en la app.
    documento VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- PARTE 5: VENTAS (siempre pagadas al momento; ingresan a caja al instante)
-- ------------------------------------------------------------
CREATE TABLE ventas (
    id SERIAL PRIMARY KEY,
    cliente_id INT REFERENCES clientes(id),
    estado VARCHAR(20) DEFAULT 'completada' CHECK (estado IN ('pendiente', 'completada', 'cancelada')),
    total NUMERIC(10,2) NOT NULL,
    caja_destino VARCHAR(20) DEFAULT 'empresa' CHECK (caja_destino IN ('empresa', 'personal')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE venta_items (
    id SERIAL PRIMARY KEY,
    venta_id INT REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INT REFERENCES productos(id),
    cantidad INT NOT NULL,
    precio_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- ------------------------------------------------------------
-- PARTE 6: CONSIGNACIONES — ventas cuyo cobro queda pendiente.
-- El stock sale igual que en una venta normal, pero el dinero NO entra a
-- caja hasta que se registren pagos (parciales o totales) en
-- consignacion_pagos. monto_cobrado y saldo_pendiente se mantienen
-- actualizados vía trigger; saldo_pendiente es lo que Finanzas expone
-- como "Cuentas por cobrar".
-- ------------------------------------------------------------
CREATE TABLE consignaciones (
    id SERIAL PRIMARY KEY,
    cliente_id INT REFERENCES clientes(id) NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'liquidada', 'parcial')),
    fecha_entrega TIMESTAMPTZ DEFAULT now(),
    fecha_limite DATE,
    monto_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    monto_cobrado NUMERIC(10,2) NOT NULL DEFAULT 0,
    saldo_pendiente NUMERIC(10,2) GENERATED ALWAYS AS (monto_total - monto_cobrado) STORED,
    caja_destino VARCHAR(20) DEFAULT 'empresa' CHECK (caja_destino IN ('empresa', 'personal')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE consignacion_items (
    id SERIAL PRIMARY KEY,
    consignacion_id INT REFERENCES consignaciones(id) ON DELETE CASCADE,
    producto_id INT REFERENCES productos(id),
    cantidad INT NOT NULL,
    precio_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE TABLE consignacion_pagos (
    id SERIAL PRIMARY KEY,
    consignacion_id INT REFERENCES consignaciones(id) ON DELETE CASCADE,
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    nota TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- PARTE 7: FINANZAS BIMODAL
-- ------------------------------------------------------------
CREATE TABLE cajas (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL UNIQUE CHECK (tipo IN ('empresa', 'personal')),
    saldo_actual NUMERIC(12,2) NOT NULL DEFAULT 0
);
INSERT INTO cajas (tipo, saldo_actual) VALUES ('empresa', 0), ('personal', 0);

CREATE TABLE movimientos_financieros (
    id SERIAL PRIMARY KEY,
    caja_id INT REFERENCES cajas(id),
    tipo VARCHAR(20) CHECK (tipo IN ('ingreso', 'egreso', 'transferencia_interna')),
    monto NUMERIC(12,2) NOT NULL,
    categoria VARCHAR(50),
    referencia_id INT,
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- PARTE 8: RRHH — ASISTENCIA, ADELANTOS, NÓMINA
-- ------------------------------------------------------------
CREATE TABLE asistencia (
    id SERIAL PRIMARY KEY,
    empleado_id INT REFERENCES empleados(id),
    tipo VARCHAR(10) CHECK (tipo IN ('entrada', 'salida')),
    timestamp TIMESTAMPTZ DEFAULT now(),
    metodo_registro VARCHAR(20) DEFAULT 'manual' CHECK (metodo_registro IN ('manual', 'voz', 'texto'))
);

CREATE TABLE adelantos (
    id SERIAL PRIMARY KEY,
    empleado_id INT REFERENCES empleados(id),
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    motivo TEXT,
    descontado BOOLEAN DEFAULT false,
    nomina_id INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE nomina (
    id SERIAL PRIMARY KEY,
    empleado_id INT REFERENCES empleados(id),
    semana_inicio DATE NOT NULL,
    semana_fin DATE NOT NULL,
    horas_trabajadas NUMERIC(6,2) NOT NULL DEFAULT 0,
    monto_bruto NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_adelantos NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_pagar NUMERIC(10,2) NOT NULL,
    pagado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(empleado_id, semana_inicio)
);

ALTER TABLE adelantos ADD CONSTRAINT fk_adelantos_nomina
    FOREIGN KEY (nomina_id) REFERENCES nomina(id);

-- ============================================================
-- FUNCIONES: ROLES, HORAS TRABAJADAS Y NÓMINA
-- ============================================================
CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION calcular_horas_semana(
    p_empleado_id INT, p_semana_inicio DATE, p_semana_fin DATE
) RETURNS NUMERIC
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_horas NUMERIC := 0;
BEGIN
    WITH marcas AS (
        SELECT timestamp, tipo,
            LEAD(timestamp) OVER (PARTITION BY DATE(timestamp) ORDER BY timestamp) AS siguiente_timestamp,
            LEAD(tipo) OVER (PARTITION BY DATE(timestamp) ORDER BY timestamp) AS siguiente_tipo
        FROM asistencia
        WHERE empleado_id = p_empleado_id AND DATE(timestamp) BETWEEN p_semana_inicio AND p_semana_fin
    ),
    pares_validos AS (
        SELECT EXTRACT(EPOCH FROM (siguiente_timestamp - timestamp)) / 3600.0 AS horas
        FROM marcas WHERE tipo = 'entrada' AND siguiente_tipo = 'salida'
    )
    SELECT COALESCE(SUM(horas), 0) INTO v_horas FROM pares_validos;
    RETURN ROUND(v_horas, 2);
END;
$$ LANGUAGE plpgsql;

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

-- ============================================================
-- TRIGGERS: VENTAS
-- ============================================================
CREATE OR REPLACE FUNCTION procesar_venta_item()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE productos SET stock_actual = stock_actual - NEW.cantidad WHERE id = NEW.producto_id;
    INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, referencia_id)
    VALUES (NEW.producto_id, 'venta', NEW.cantidad, NEW.venta_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venta_item AFTER INSERT ON venta_items
FOR EACH ROW EXECUTE FUNCTION procesar_venta_item();

CREATE OR REPLACE FUNCTION procesar_venta_financiero()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    caja_id_target INT;
    v_nombre_cliente TEXT;
BEGIN
    SELECT id INTO caja_id_target FROM cajas WHERE tipo = NEW.caja_destino;
    SELECT nombre INTO v_nombre_cliente FROM clientes WHERE id = NEW.cliente_id;

    INSERT INTO movimientos_financieros (caja_id, tipo, monto, categoria, referencia_id, descripcion)
    VALUES (caja_id_target, 'ingreso', NEW.total, 'venta', NEW.id, 'Venta a ' || COALESCE(v_nombre_cliente, 'cliente #' || NEW.cliente_id));

    UPDATE cajas SET saldo_actual = saldo_actual + NEW.total WHERE id = caja_id_target;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venta_financiero AFTER INSERT ON ventas
FOR EACH ROW WHEN (NEW.estado = 'completada')
EXECUTE FUNCTION procesar_venta_financiero();

-- Reversión al cancelar: devuelve el stock de cada item y genera el
-- egreso contracargo en la caja destino.
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

CREATE TRIGGER trg_venta_cancelada AFTER UPDATE OF estado ON ventas
FOR EACH ROW EXECUTE FUNCTION revertir_venta_cancelada();

-- ============================================================
-- TRIGGERS: CONSIGNACIONES
-- Salida de stock igual que una venta, pero SIN generar ingreso en caja
-- (el dinero aún no se ha cobrado). El ingreso real llega vía
-- consignacion_pagos.
-- ============================================================
CREATE OR REPLACE FUNCTION procesar_consignacion_item()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE productos SET stock_actual = stock_actual - NEW.cantidad WHERE id = NEW.producto_id;
    INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, referencia_id)
    VALUES (NEW.producto_id, 'consignacion', NEW.cantidad, NEW.consignacion_id);

    UPDATE consignaciones SET monto_total = monto_total + NEW.subtotal WHERE id = NEW.consignacion_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consignacion_item AFTER INSERT ON consignacion_items
FOR EACH ROW EXECUTE FUNCTION procesar_consignacion_item();

CREATE OR REPLACE FUNCTION procesar_consignacion_pago()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_caja_id INT;
    v_caja_destino VARCHAR(20);
    v_monto_total NUMERIC;
    v_nombre_cliente TEXT;
    v_nuevo_cobrado NUMERIC;
BEGIN
    SELECT caja_destino, monto_total INTO v_caja_destino, v_monto_total
    FROM consignaciones WHERE id = NEW.consignacion_id;

    SELECT c.nombre INTO v_nombre_cliente
    FROM consignaciones cons JOIN clientes c ON c.id = cons.cliente_id
    WHERE cons.id = NEW.consignacion_id;

    SELECT id INTO v_caja_id FROM cajas WHERE tipo = v_caja_destino;

    INSERT INTO movimientos_financieros (caja_id, tipo, monto, categoria, referencia_id, descripcion)
    VALUES (v_caja_id, 'ingreso', NEW.monto, 'consignacion_pago', NEW.consignacion_id, 'Pago de consignación — ' || COALESCE(v_nombre_cliente, 'cliente'));

    UPDATE cajas SET saldo_actual = saldo_actual + NEW.monto WHERE id = v_caja_id;

    UPDATE consignaciones SET monto_cobrado = monto_cobrado + NEW.monto
    WHERE id = NEW.consignacion_id
    RETURNING monto_cobrado INTO v_nuevo_cobrado;

    UPDATE consignaciones
    SET estado = CASE
        WHEN v_nuevo_cobrado >= monto_total THEN 'liquidada'
        WHEN v_nuevo_cobrado > 0 THEN 'parcial'
        ELSE 'pendiente'
    END
    WHERE id = NEW.consignacion_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consignacion_pago AFTER INSERT ON consignacion_pagos
FOR EACH ROW EXECUTE FUNCTION procesar_consignacion_pago();

-- ============================================================
-- TRIGGERS: ADELANTOS Y NÓMINA
-- ============================================================
CREATE OR REPLACE FUNCTION procesar_adelanto_financiero()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
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

CREATE TRIGGER trg_adelanto_financiero AFTER INSERT ON adelantos
FOR EACH ROW EXECUTE FUNCTION procesar_adelanto_financiero();

CREATE OR REPLACE FUNCTION procesar_nomina_pagada()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
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

CREATE TRIGGER trg_nomina_pagada AFTER UPDATE ON nomina
FOR EACH ROW EXECUTE FUNCTION procesar_nomina_pagada();

-- ============================================================
-- RPCs TRANSACCIONALES (los usa la app en vez de inserts sueltos:
-- validan stock/saldo/rol y todo ocurre en UNA transacción)
-- ============================================================
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

-- ============================================================
-- RPC: resumen_financiero — agregado para el "Resumen de ganancias"
-- de la pantalla de Finanzas. Una sola consulta en lugar de traer
-- todas las ventas + items + movimientos al cliente.
-- Devuelve:
--   ventas_brutas, costo_productos_vendidos,
--   ingresos_consignaciones, otros_ingresos,
--   egresos_gasto_manual, egresos_adelanto,
--   egresos_nomina, egresos_venta_cancelada
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

  -- Valor del inventario actual a costo: el dinero "guardado" en mercadería.
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
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignacion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignacion_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_financieros ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE adelantos ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina ENABLE ROW LEVEL SECURITY;

-- Tablas operativas: cualquier autenticado lee/escribe (WITH CHECK explícito
-- requerido para que los INSERT no sean rechazados por RLS).
CREATE POLICY autenticados_acceso_productos ON productos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_mov_inv ON movimientos_inventario FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_clientes ON clientes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_ventas ON ventas FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_venta_items ON venta_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_consig ON consignaciones FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_consig_items ON consignacion_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_consig_pagos ON consignacion_pagos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_empleados ON empleados FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_asistencia ON asistencia FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Finanzas: políticas resueltas contra user_roles (no dependen del Auth Hook).
CREATE POLICY admin_full_access_cajas ON cajas
    FOR ALL
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY empleado_solo_lectura_cajas_empresa ON cajas
    FOR SELECT USING (
        tipo = 'empresa' AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY admin_full_access_financiero ON movimientos_financieros
    FOR ALL
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY empleado_ve_solo_empresa ON movimientos_financieros
    FOR SELECT USING (
        caja_id = (SELECT id FROM cajas WHERE tipo = 'empresa')
        AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY admin_full_access_adelantos ON adelantos
    FOR ALL
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY admin_full_access_nomina ON nomina
    FOR ALL
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ============================================================
-- REALTIME: la app se suscribe a cambios de productos
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE productos;

-- ============================================================
-- PARTE FINAL: asigna tu usuario admin (reemplaza el correo y corre aparte)
-- ============================================================
-- INSERT INTO user_roles (user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = 'tu-correo@ejemplo.com'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Vincula tu cuenta con tu ficha de empleado (para "marcar mi entrada"):
-- UPDATE empleados SET user_id = (SELECT id FROM auth.users WHERE email = 'tu-correo@ejemplo.com')
-- WHERE nombre = 'Tu Nombre Exacto';

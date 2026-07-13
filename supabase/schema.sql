-- ============================================================
-- ESQUEMA COMPLETO ERP ACCESORIOS - SUPABASE SQL EDITOR
-- ============================================================

-- ============ INVENTARIO ============
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('funda', 'cargador')),
    modelo VARCHAR(50) NOT NULL,
    variante VARCHAR(100),
    stock_actual INT NOT NULL DEFAULT 0,
    stock_minimo INT DEFAULT 10,
    precio_unitario NUMERIC(10,2) NOT NULL,
    costo_unitario NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tipo, modelo, variante)
);

-- ============ RRHH (empleados primero, referenciado por movimientos_inventario) ============
CREATE TABLE empleados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    salario_hora NUMERIC(10,2) NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

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

-- ============ VENTAS ============
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    tipo_cliente VARCHAR(20) DEFAULT 'mayorista' CHECK (tipo_cliente IN ('mayorista', 'minorista', 'vendedor')),
    telefono VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT now()
);

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

-- ============ CONSIGNACIONES (Vendedores) ============
CREATE TABLE consignaciones (
    id SERIAL PRIMARY KEY,
    vendedor_id INT REFERENCES clientes(id),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'liquidada', 'parcial')),
    fecha_entrega TIMESTAMPTZ DEFAULT now(),
    fecha_limite DATE,
    monto_total NUMERIC(10,2),
    monto_cobrado NUMERIC(10,2) DEFAULT 0
);

CREATE TABLE consignacion_items (
    id SERIAL PRIMARY KEY,
    consignacion_id INT REFERENCES consignaciones(id) ON DELETE CASCADE,
    producto_id INT REFERENCES productos(id),
    cantidad_entregada INT NOT NULL,
    cantidad_devuelta INT DEFAULT 0,
    cantidad_vendida INT GENERATED ALWAYS AS (cantidad_entregada - cantidad_devuelta) STORED,
    precio_unitario NUMERIC(10,2) NOT NULL
);

-- ============ FINANZAS BIMODAL ============
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

-- ============ RRHH: ASISTENCIA ============
CREATE TABLE asistencia (
    id SERIAL PRIMARY KEY,
    empleado_id INT REFERENCES empleados(id),
    tipo VARCHAR(10) CHECK (tipo IN ('entrada', 'salida')),
    timestamp TIMESTAMPTZ DEFAULT now(),
    metodo_registro VARCHAR(20) DEFAULT 'manual' CHECK (metodo_registro IN ('manual', 'voz', 'texto'))
);

-- ============ RRHH: ADELANTOS ============
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

-- ============ RRHH: NOMINA (SEMANAL, POR HORAS) ============
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
-- FUNCIONES: CÁLCULO DE HORAS TRABAJADAS
-- ============================================================

-- Edge case: turno abierto (entrada sin salida) se ignora en el cálculo.
-- Edge case: turnos que cruzan medianoche NO soportados en esta versión.
CREATE OR REPLACE FUNCTION calcular_horas_semana(
    p_empleado_id INT,
    p_semana_inicio DATE,
    p_semana_fin DATE
) RETURNS NUMERIC AS $$
DECLARE
    v_horas NUMERIC := 0;
BEGIN
    WITH marcas AS (
        SELECT
            timestamp,
            tipo,
            LEAD(timestamp) OVER (PARTITION BY DATE(timestamp) ORDER BY timestamp) AS siguiente_timestamp,
            LEAD(tipo) OVER (PARTITION BY DATE(timestamp) ORDER BY timestamp) AS siguiente_tipo
        FROM asistencia
        WHERE empleado_id = p_empleado_id
          AND DATE(timestamp) BETWEEN p_semana_inicio AND p_semana_fin
    ),
    pares_validos AS (
        SELECT
            EXTRACT(EPOCH FROM (siguiente_timestamp - timestamp)) / 3600.0 AS horas
        FROM marcas
        WHERE tipo = 'entrada' AND siguiente_tipo = 'salida'
    )
    SELECT COALESCE(SUM(horas), 0) INTO v_horas FROM pares_validos;

    RETURN ROUND(v_horas, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN: GENERAR NÓMINA SEMANAL (incluye descuento de adelantos)
-- ============================================================

CREATE OR REPLACE FUNCTION generar_nomina_semanal(
    p_empleado_id INT,
    p_semana_inicio DATE -- debe ser el lunes (o día de inicio de semana) de la semana a liquidar
) RETURNS INT AS $$
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

-- ============================================================
-- TRIGGERS: MOVIMIENTOS FINANCIEROS Y DE INVENTARIO AUTOMÁTICOS
-- ============================================================

CREATE OR REPLACE FUNCTION procesar_venta_item()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE productos SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.producto_id;

    INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, referencia_id)
    VALUES (NEW.producto_id, 'venta', NEW.cantidad, NEW.venta_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venta_item
AFTER INSERT ON venta_items
FOR EACH ROW EXECUTE FUNCTION procesar_venta_item();

CREATE OR REPLACE FUNCTION procesar_venta_financiero()
RETURNS TRIGGER AS $$
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

CREATE TRIGGER trg_venta_financiero
AFTER INSERT ON ventas
FOR EACH ROW WHEN (NEW.estado = 'completada')
EXECUTE FUNCTION procesar_venta_financiero();

CREATE OR REPLACE FUNCTION procesar_adelanto_financiero()
RETURNS TRIGGER AS $$
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

CREATE TRIGGER trg_adelanto_financiero
AFTER INSERT ON adelantos
FOR EACH ROW EXECUTE FUNCTION procesar_adelanto_financiero();

CREATE OR REPLACE FUNCTION procesar_nomina_pagada()
RETURNS TRIGGER AS $$
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

CREATE TRIGGER trg_nomina_pagada
AFTER UPDATE ON nomina
FOR EACH ROW EXECUTE FUNCTION procesar_nomina_pagada();

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
ALTER TABLE cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_financieros ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE adelantos ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina ENABLE ROW LEVEL SECURITY;

-- Acceso general: cualquier usuario autenticado (admin o empleado) puede
-- leer/escribir en las tablas operativas (Inventario, Ventas, RRHH básico).
CREATE POLICY autenticados_acceso_productos ON productos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_mov_inv ON movimientos_inventario FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_clientes ON clientes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_ventas ON ventas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_venta_items ON venta_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_consig ON consignaciones FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_consig_items ON consignacion_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_empleados ON empleados FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY autenticados_acceso_asistencia ON asistencia FOR ALL USING (auth.role() = 'authenticated');

-- Finanzas: acceso restringido. La caja 'personal' solo la ve/edita el admin.
CREATE POLICY admin_full_access_cajas ON cajas
    FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY empleado_solo_lectura_cajas_empresa ON cajas
    FOR SELECT USING (
        auth.jwt() -> 'app_metadata' ->> 'role' = 'empleado' AND tipo = 'empresa'
    );

CREATE POLICY admin_full_access_financiero ON movimientos_financieros
    FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY empleado_ve_solo_empresa ON movimientos_financieros
    FOR SELECT USING (
        auth.jwt() -> 'app_metadata' ->> 'role' = 'empleado'
        AND caja_id = (SELECT id FROM cajas WHERE tipo = 'empresa')
    );

-- Adelantos y nómina: solo admin gestiona (datos sensibles de sueldo).
CREATE POLICY admin_full_access_adelantos ON adelantos
    FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY admin_full_access_nomina ON nomina
    FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

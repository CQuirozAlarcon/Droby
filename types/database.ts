export type TipoProducto = 'funda' | 'cargador';
export type TipoCliente = 'mayorista' | 'minorista' | 'vendedor';
export type EstadoVenta = 'pendiente' | 'completada' | 'cancelada';
export type CajaDestino = 'empresa' | 'personal';
export type EstadoConsignacion = 'pendiente' | 'liquidada' | 'parcial';
export type TipoMovimientoInventario = 'entrada' | 'salida' | 'ajuste' | 'venta' | 'consignacion';
export type TipoMovimientoFinanciero = 'ingreso' | 'egreso' | 'transferencia_interna';
export type TipoAsistencia = 'entrada' | 'salida';
export type MetodoRegistro = 'manual' | 'voz' | 'texto';
export type Rol = 'admin' | 'empleado';

export interface Producto {
  id: number;
  tipo: TipoProducto;
  modelo: string;
  variante: string | null;
  stock_actual: number;
  stock_minimo: number;
  precio_unitario: number;
  costo_unitario: number;
  created_at: string;
}

export interface MovimientoInventario {
  id: number;
  producto_id: number;
  tipo_movimiento: TipoMovimientoInventario;
  cantidad: number;
  referencia_id: number | null;
  nota: string | null;
  operador_id: number | null;
  created_at: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  tipo_cliente: TipoCliente;
  telefono: string | null;
  created_at: string;
}

export interface Venta {
  id: number;
  cliente_id: number;
  estado: EstadoVenta;
  total: number;
  caja_destino: CajaDestino;
  created_at: string;
}

export interface VentaItem {
  id: number;
  venta_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface VentaItemInput {
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
}

export interface Consignacion {
  id: number;
  vendedor_id: number;
  estado: EstadoConsignacion;
  fecha_entrega: string;
  fecha_limite: string | null;
  monto_total: number | null;
  monto_cobrado: number;
}

export interface ConsignacionItem {
  id: number;
  consignacion_id: number;
  producto_id: number;
  cantidad_entregada: number;
  cantidad_devuelta: number;
  cantidad_vendida: number;
  precio_unitario: number;
}

export interface Caja {
  id: number;
  tipo: CajaDestino;
  saldo_actual: number;
}

export interface MovimientoFinanciero {
  id: number;
  caja_id: number;
  tipo: TipoMovimientoFinanciero;
  monto: number;
  categoria: string | null;
  referencia_id: number | null;
  descripcion: string | null;
  created_at: string;
}

export interface Empleado {
  id: number;
  nombre: string;
  salario_hora: number;
  activo: boolean;
  created_at: string;
}

export interface Asistencia {
  id: number;
  empleado_id: number;
  tipo: TipoAsistencia;
  timestamp: string;
  metodo_registro: MetodoRegistro;
}

export interface Adelanto {
  id: number;
  empleado_id: number;
  monto: number;
  fecha: string;
  motivo: string | null;
  descontado: boolean;
  nomina_id: number | null;
  created_at: string;
}

export interface Nomina {
  id: number;
  empleado_id: number;
  semana_inicio: string;
  semana_fin: string;
  horas_trabajadas: number;
  monto_bruto: number;
  total_adelantos: number;
  total_pagar: number;
  pagado: boolean;
  created_at: string;
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TipoProducto } from '@/types/database';

export interface RankingProducto {
  producto_id: number;
  modelo: string;
  tipo: TipoProducto;
  variante: string | null;
  unidadesVendidas: number;
  ingresos: number;
}

export interface ModeloPreferido {
  modelo: string;
  tipo: TipoProducto;
  cantidad: number;
}

export interface RankingCliente {
  cliente_id: number;
  nombre: string;
  totalComprado: number;
  numeroVentas: number;
  modelosPreferidos: ModeloPreferido[]; // ordenados de mayor a menor cantidad
}

export interface RankingEmpleado {
  empleado_id: number;
  nombre: string;
  horasTrabajadas: number;
  totalPagado: number;
  totalAdelantos: number;
}

// Todas las agregaciones se hacen en el cliente a partir de las filas crudas:
// el volumen de datos de este negocio (ventas/nómina de una pyme) es lo
// bastante chico para que no valga la pena mantener vistas materializadas
// en Postgres solo para esto.
export function useEstadisticas() {
  const [topProductos, setTopProductos] = useState<RankingProducto[]>([]);
  const [rankingClientes, setRankingClientes] = useState<RankingCliente[]>([]);
  const [rankingEmpleados, setRankingEmpleados] = useState<RankingEmpleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodo = useCallback(async () => {
    setLoading(true);
    try {
      const [ventasRes, consigRes, nominaRes] = await Promise.all([
        supabase
          .from('ventas')
          .select('id, cliente_id, estado, clientes(nombre), venta_items(cantidad, precio_unitario, subtotal, producto_id, productos(modelo, tipo, variante))')
          .eq('estado', 'completada'),
        supabase
          .from('consignaciones')
          .select('id, cliente_id, clientes(nombre), consignacion_items(cantidad, precio_unitario, subtotal, producto_id, productos(modelo, tipo, variante))'),
        supabase.from('nomina').select('empleado_id, horas_trabajadas, total_pagar, total_adelantos, empleados(nombre)'),
      ]);

      if (ventasRes.error) throw new Error(ventasRes.error.message);
      if (consigRes.error) throw new Error(consigRes.error.message);
      // La nómina solo es legible por admin (RLS): para empleados degradamos
      // a lista vacía en vez de tumbar TODAS las estadísticas del hook.
      if (nominaRes.error) console.warn('Sin acceso a nómina para estadísticas:', nominaRes.error.message);
      const nominaData = nominaRes.error ? [] : ((nominaRes.data as any[]) ?? []);

      const productoMap = new Map<number, RankingProducto>();
      const clienteMap = new Map<number, { nombre: string; total: number; ventas: number; modelos: Map<string, ModeloPreferido> }>();

      function acumularItems(items: any[], clienteId: number, nombreCliente: string, cuentaComoVenta: boolean) {
        if (!clienteMap.has(clienteId)) {
          clienteMap.set(clienteId, { nombre: nombreCliente, total: 0, ventas: 0, modelos: new Map() });
        }
        const entradaCliente = clienteMap.get(clienteId)!;
        if (cuentaComoVenta) entradaCliente.ventas += 1;

        for (const item of items ?? []) {
          const prod = item.productos;
          if (!prod) continue;
          const subtotal = Number(item.subtotal ?? item.cantidad * item.precio_unitario);
          entradaCliente.total += subtotal;

          const claveModelo = `${prod.tipo}::${prod.modelo}`;
          const existenteModelo = entradaCliente.modelos.get(claveModelo);
          if (existenteModelo) existenteModelo.cantidad += item.cantidad;
          else entradaCliente.modelos.set(claveModelo, { modelo: prod.modelo, tipo: prod.tipo, cantidad: item.cantidad });

          if (!productoMap.has(item.producto_id)) {
            productoMap.set(item.producto_id, {
              producto_id: item.producto_id, modelo: prod.modelo, tipo: prod.tipo, variante: prod.variante,
              unidadesVendidas: 0, ingresos: 0,
            });
          }
          const entradaProducto = productoMap.get(item.producto_id)!;
          entradaProducto.unidadesVendidas += item.cantidad;
          entradaProducto.ingresos += subtotal;
        }
      }

      for (const venta of (ventasRes.data as any[]) ?? []) {
        acumularItems(venta.venta_items, venta.cliente_id, venta.clientes?.nombre ?? `Cliente #${venta.cliente_id}`, true);
      }
      for (const cons of (consigRes.data as any[]) ?? []) {
        acumularItems(cons.consignacion_items, cons.cliente_id, cons.clientes?.nombre ?? `Cliente #${cons.cliente_id}`, false);
      }

      const productosOrdenados = Array.from(productoMap.values()).sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);

      const clientesOrdenados: RankingCliente[] = Array.from(clienteMap.entries())
        .map(([cliente_id, v]) => ({
          cliente_id,
          nombre: v.nombre,
          totalComprado: v.total,
          numeroVentas: v.ventas,
          modelosPreferidos: Array.from(v.modelos.values()).sort((a, b) => b.cantidad - a.cantidad),
        }))
        .sort((a, b) => b.totalComprado - a.totalComprado);

      const empleadoMap = new Map<number, RankingEmpleado>();
      for (const n of nominaData) {
        if (!empleadoMap.has(n.empleado_id)) {
          empleadoMap.set(n.empleado_id, {
            empleado_id: n.empleado_id, nombre: n.empleados?.nombre ?? `Empleado #${n.empleado_id}`,
            horasTrabajadas: 0, totalPagado: 0, totalAdelantos: 0,
          });
        }
        const e = empleadoMap.get(n.empleado_id)!;
        e.horasTrabajadas += Number(n.horas_trabajadas);
        e.totalPagado += Number(n.total_pagar);
        e.totalAdelantos += Number(n.total_adelantos);
      }
      const empleadosOrdenados = Array.from(empleadoMap.values()).sort((a, b) => b.horasTrabajadas - a.horasTrabajadas);

      setTopProductos(productosOrdenados);
      setRankingClientes(clientesOrdenados);
      setRankingEmpleados(empleadosOrdenados);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodo();
  }, [fetchTodo]);

  return { topProductos, rankingClientes, rankingEmpleados, loading, error, refetch: fetchTodo };
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Cliente, Consignacion, TipoCliente, Venta } from '@/types/database';

// Cliente + resumen calculado a partir de sus ventas completadas.
// Sirve para la lista de la pestaña Clientes: nombre, total comprado,
// número de ventas, última venta (para ordenar/filtrar).
export interface ClienteConResumen extends Cliente {
  totalVentas: number;
  numeroVentas: number;
  ultimaVenta: string | null;
}

// Cliente + todo su historial (ventas y consignaciones). Lo usa la pantalla
// de detalle para mostrar la lista de operaciones hechas con este cliente.
export interface ClienteDetalle extends Cliente {
  ventas: Venta[];
  consignaciones: Consignacion[];
}

export function useClientes() {
  const [clientes, setClientes] = useState<ClienteConResumen[]>([]);
  const [loading, setLoading] = useState(true);

  // Una sola query con embebido (PostgREST) trae cada cliente con sus ventas
  // y consignaciones. Antes de tener `useClientes` no había forma de listar
  // clientes con su histórico desde la app: había que ir a la BD a mano.
  const fetchClientes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clientes')
      .select(`
        id, nombre, tipo_cliente, telefono, documento, created_at,
        ventas(id, total, estado, created_at),
        consignaciones(id, monto_total, estado, created_at)
      `)
      .order('nombre');

    if (error) {
      console.warn('Error cargando clientes:', error.message);
      setClientes([]);
      setLoading(false);
      return;
    }

    const enriched: ClienteConResumen[] = ((data as any[]) ?? []).map((c) => {
      const ventasCompletadas = (c.ventas ?? []).filter((v: any) => v.estado === 'completada');
      const totalVentas = ventasCompletadas.reduce(
        (sum: number, v: any) => sum + Number(v.total),
        0
      );
      const numeroVentas = ventasCompletadas.length;
      const ultimaVenta =
        ventasCompletadas
          .map((v: any) => v.created_at as string)
          .sort()
          .pop() ?? null;

      return {
        id: c.id,
        nombre: c.nombre,
        tipo_cliente: c.tipo_cliente,
        telefono: c.telefono,
        documento: c.documento,
        created_at: c.created_at,
        totalVentas,
        numeroVentas,
        ultimaVenta,
      };
    });

    setClientes(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  async function crearCliente(input: {
    nombre: string;
    tipo_cliente: TipoCliente;
    telefono: string | null;
    documento: string | null;
  }) {
    const { error } = await supabase.from('clientes').insert(input);
    if (error) throw new Error(error.message);
    await fetchClientes();
  }

  async function actualizarCliente(
    id: number,
    cambios: Partial<{
      nombre: string;
      tipo_cliente: TipoCliente;
      telefono: string | null;
      documento: string | null;
    }>
  ) {
    const { error } = await supabase.from('clientes').update(cambios).eq('id', id);
    if (error) throw new Error(error.message);
    await fetchClientes();
  }

  return {
    clientes,
    loading,
    crearCliente,
    actualizarCliente,
    refetch: fetchClientes,
  };
}

export function useClienteDetalle(clienteId: number | null) {
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetalle = useCallback(async () => {
    if (clienteId === null) {
      setCliente(null);
      return;
    }
    setLoading(true);

    const [clienteRes, ventasRes, consigRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle(),
      supabase
        .from('ventas')
        .select('*, venta_items(cantidad, precio_unitario, subtotal, productos(modelo, tipo, variante))')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false }),
      supabase
        .from('consignaciones')
        .select('*, consignacion_items(cantidad, precio_unitario, subtotal, productos(modelo, tipo, variante)), consignacion_pagos(monto, fecha, nota, created_at)')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false }),
    ]);

    if (clienteRes.error) {
      console.warn('Error cargando cliente:', clienteRes.error.message);
      setCliente(null);
      setLoading(false);
      return;
    }
    if (!clienteRes.data) {
      setCliente(null);
      setLoading(false);
      return;
    }

    setCliente({
      ...(clienteRes.data as Cliente),
      ventas: (ventasRes.data as unknown as Venta[]) ?? [],
      consignaciones: (consigRes.data as unknown as Consignacion[]) ?? [],
    });
    setLoading(false);
  }, [clienteId]);

  useEffect(() => {
    fetchDetalle();
  }, [fetchDetalle]);

  return { cliente, loading, refetch: fetchDetalle };
}

export async function obtenerClientePorId(id: number): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Cliente) ?? null;
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TipoProducto } from '@/types/database';

export interface StatProducto {
  id: number;
  modelo: string;
  variante: string | null;
  stock_actual: number;
  unidades_vendidas: number;
  ingresos: number;
}

export function useEstadisticasProductos() {
  const [fundas, setFundas] = useState<StatProducto[]>([]);
  const [cargadores, setCargadores] = useState<StatProducto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDatos = useCallback(async () => {
    setLoading(true);
    const [{ data: productos }, { data: items }] = await Promise.all([
      supabase.from('productos').select('*'),
      supabase.from('venta_items').select('producto_id, cantidad, subtotal'),
    ]);

    const agregados = new Map<number, { unidades: number; ingresos: number }>();
    (items ?? []).forEach((it: any) => {
      const prev = agregados.get(it.producto_id) ?? { unidades: 0, ingresos: 0 };
      prev.unidades += it.cantidad;
      prev.ingresos += Number(it.subtotal);
      agregados.set(it.producto_id, prev);
    });

    const armar = (tipo: TipoProducto): StatProducto[] =>
      (productos ?? [])
        .filter((p: any) => p.tipo === tipo)
        .map((p: any) => ({
          id: p.id,
          modelo: p.modelo,
          variante: p.variante,
          stock_actual: p.stock_actual,
          unidades_vendidas: agregados.get(p.id)?.unidades ?? 0,
          ingresos: agregados.get(p.id)?.ingresos ?? 0,
        }))
        .sort((a, b) => b.unidades_vendidas - a.unidades_vendidas);

    setFundas(armar('funda'));
    setCargadores(armar('cargador'));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDatos();
  }, [fetchDatos]);

  return { fundas, cargadores, loading, refetch: fetchDatos };
}

export interface StatCliente {
  cliente_id: number;
  nombre: string;
  unidades_fundas: number;
  unidades_cargadores: number;
  total_comprado: number;
}

export function useEstadisticasClientes() {
  const [clientes, setClientes] = useState<StatCliente[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDatos = useCallback(async () => {
    setLoading(true);
    // Embedded select: requiere las FKs ya existentes en el esquema.
    const { data, error } = await supabase
      .from('venta_items')
      .select('cantidad, subtotal, productos(tipo), ventas(cliente_id, clientes(id, nombre))');

    if (error || !data) {
      setLoading(false);
      return;
    }

    const agregados = new Map<number, StatCliente>();
    (data as any[]).forEach((row) => {
      const cliente = row.ventas?.clientes;
      if (!cliente) return;
      const tipo = row.productos?.tipo as TipoProducto | undefined;
      const prev = agregados.get(cliente.id) ?? {
        cliente_id: cliente.id,
        nombre: cliente.nombre,
        unidades_fundas: 0,
        unidades_cargadores: 0,
        total_comprado: 0,
      };
      if (tipo === 'funda') prev.unidades_fundas += row.cantidad;
      if (tipo === 'cargador') prev.unidades_cargadores += row.cantidad;
      prev.total_comprado += Number(row.subtotal);
      agregados.set(cliente.id, prev);
    });

    setClientes(Array.from(agregados.values()).sort((a, b) => b.total_comprado - a.total_comprado));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDatos();
  }, [fetchDatos]);

  return { clientes, loading, refetch: fetchDatos };
}

export interface StatEmpleado {
  empleado_id: number;
  nombre: string;
  horas_totales: number;
  total_pagado: number;
  adelantos_pendientes: number;
}

export function useEstadisticasEmpleados() {
  const [empleados, setEmpleados] = useState<StatEmpleado[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDatos = useCallback(async () => {
    setLoading(true);
    const [{ data: emp }, { data: nom }, { data: adel }] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('activo', true),
      supabase.from('nomina').select('empleado_id, horas_trabajadas, total_pagar'),
      supabase.from('adelantos').select('empleado_id, saldo_pendiente, descontado'),
    ]);

    const resultado = (emp ?? []).map((e: any) => {
      const horas = (nom ?? [])
        .filter((n: any) => n.empleado_id === e.id)
        .reduce((acc: number, n: any) => acc + Number(n.horas_trabajadas), 0);
      const pagado = (nom ?? [])
        .filter((n: any) => n.empleado_id === e.id)
        .reduce((acc: number, n: any) => acc + Number(n.total_pagar), 0);
      const deuda = (adel ?? [])
        .filter((a: any) => a.empleado_id === e.id && !a.descontado)
        .reduce((acc: number, a: any) => acc + Number(a.saldo_pendiente), 0);

      return { empleado_id: e.id, nombre: e.nombre, horas_totales: horas, total_pagado: pagado, adelantos_pendientes: deuda };
    });

    setEmpleados(resultado.sort((a, b) => b.horas_totales - a.horas_totales));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDatos();
  }, [fetchDatos]);

  return { empleados, loading, refetch: fetchDatos };
}
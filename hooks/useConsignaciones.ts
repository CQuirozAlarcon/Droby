import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CajaDestino, Consignacion, VentaItemInput } from '@/types/database';

const SELECT_CONSIGNACION_COMPLETA =
  '*, clientes(nombre, telefono), consignacion_items(*, productos(modelo, tipo, variante)), consignacion_pagos(*)';

export function useConsignaciones() {
  const [consignaciones, setConsignaciones] = useState<Consignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsignaciones = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('consignaciones')
      .select(SELECT_CONSIGNACION_COMPLETA)
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'consignacion_pagos', ascending: false })
      .limit(500);
    if (error) setError(error.message);
    else {
      setConsignaciones(data as unknown as Consignacion[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConsignaciones();
  }, [fetchConsignaciones]);

  const obtenerConsignacionPorId = useCallback(async (consignacionId: number): Promise<Consignacion | null> => {
    const { data, error } = await supabase
      .from('consignaciones')
      .select(SELECT_CONSIGNACION_COMPLETA)
      .eq('id', consignacionId)
      .order('created_at', { referencedTable: 'consignacion_pagos', ascending: false })
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as Consignacion | null;
  }, []);

  // Creación y pago van por RPC transaccional: validan stock / saldo
  // pendiente y ejecutan todo en una sola transacción.
  async function crearConsignacion(
    clienteId: number,
    items: VentaItemInput[],
    fechaLimite: string | null = null,
    cajaDestino: CajaDestino = 'empresa'
  ) {
    if (items.length === 0) throw new Error('La consignación necesita al menos un producto');

    const { data: consignacionId, error } = await supabase.rpc('crear_consignacion', {
      p_cliente_id: clienteId,
      p_items: items,
      p_fecha_limite: fechaLimite,
      p_caja_destino: cajaDestino,
    });
    if (error) throw new Error(error.message);

    await fetchConsignaciones();
    const consignacion = await obtenerConsignacionPorId(consignacionId as number);
    if (!consignacion) throw new Error('La consignación se creó pero no se pudo recargar');
    return consignacion;
  }

  // El RPC valida que el pago no exceda el saldo pendiente; el trigger de
  // BD actualiza monto_cobrado/estado y genera el ingreso en Finanzas.
  async function registrarPago(consignacionId: number, monto: number, nota?: string) {
    if (monto <= 0) throw new Error('El monto del pago debe ser mayor a 0');
    const { error } = await supabase.rpc('registrar_pago_consignacion', {
      p_consignacion_id: consignacionId,
      p_monto: monto,
      p_nota: nota ?? null,
    });
    if (error) throw new Error(error.message);
    await fetchConsignaciones();
  }

  const totalCuentasPorCobrar = consignaciones
    .filter((c) => c.estado !== 'liquidada')
    .reduce((acc, c) => acc + Number(c.saldo_pendiente), 0);

  const pendientes = consignaciones.filter((c) => c.estado !== 'liquidada');

  return {
    consignaciones, pendientes, totalCuentasPorCobrar, loading, error,
    crearConsignacion, registrarPago, obtenerConsignacionPorId, refetch: fetchConsignaciones,
  };
}

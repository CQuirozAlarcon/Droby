import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Caja, CajaDestino, MovimientoFinanciero } from '@/types/database';

// Resumen agregado para el "Resumen de ganancias" de Finanzas.
// Sale de un RPC (resumen_financiero) que calcula todo en SQL — un solo
// round-trip en lugar de traer miles de filas al cliente.
export interface ResumenFinanciero {
  ventas_brutas: number;
  costo_productos_vendidos: number;
  ingresos_consignaciones: number;
  otros_ingresos: number;
  egresos_gasto_manual: number;
  // Compra de mercadería: es inversión, NO gasto operativo. Se muestra aparte
  // para no castigar la "Ganancia neta" cuando se estockea el almacén.
  egresos_compra_inventario: number;
  egresos_adelanto: number;
  egresos_nomina: number;
  egresos_venta_cancelada: number;
  // Stock actual a costo: el dinero "guardado" en mercadería.
  valor_inventario: number;
}

export function useFinanzas() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoFinanciero[]>([]);
  const [resumen, setResumen] = useState<ResumenFinanciero | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [
      { data: cajasData, error: errCajas },
      { data: movData, error: errMov },
      { data: resumenData, error: errResumen },
    ] = await Promise.all([
      supabase.from('cajas').select('*'),
      supabase.from('movimientos_financieros').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.rpc('resumen_financiero'),
    ]);

    if (errCajas) setError(errCajas.message);
    else setCajas(cajasData as Caja[]);

    if (errMov) setError(errMov.message);
    else setMovimientos(movData as MovimientoFinanciero[]);

    // El resumen falla sin tumbar la pantalla: podría faltar el RPC si la
    // migración no se corrió, así que degradamos a null.
    if (errResumen) {
      console.warn('No se pudo cargar el resumen financiero:', errResumen.message);
      setResumen(null);
    } else {
      setResumen((resumenData as unknown as ResumenFinanciero) ?? null);
    }

    if (!errCajas && !errMov) setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function saldoDe(tipo: CajaDestino): number {
    return cajas.find((c) => c.tipo === tipo)?.saldo_actual ?? 0;
  }

  // Ambas operaciones van por RPC transaccional en la BD (validan rol
  // admin, saldo y actualizan movimiento + saldo en una sola transacción;
  // antes eran varias escrituras sueltas que podían quedar a medias).
  async function registrarMovimientoManual(
    caja: CajaDestino, tipo: 'ingreso' | 'egreso', monto: number, categoria: string, descripcion: string
  ) {
    const { error } = await supabase.rpc('registrar_movimiento_manual', {
      p_caja_tipo: caja,
      p_tipo: tipo,
      p_monto: monto,
      p_categoria: categoria,
      p_descripcion: descripcion,
    });
    if (error) throw new Error(error.message);
    await fetchAll();
  }

  async function transferirEntreCajas(origen: CajaDestino, destino: CajaDestino, monto: number, descripcion: string) {
    if (origen === destino) throw new Error('Origen y destino no pueden ser iguales');
    const { error } = await supabase.rpc('transferir_cajas', {
      p_origen: origen,
      p_destino: destino,
      p_monto: monto,
      p_descripcion: descripcion,
    });
    if (error) throw new Error(error.message);
    await fetchAll();
  }

  return {
    cajas, movimientos, resumen, loading, error,
    saldoDe, registrarMovimientoManual, transferirEntreCajas, refetch: fetchAll,
  };
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Caja, CajaDestino, MovimientoFinanciero } from '@/types/database';

export function useFinanzas() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoFinanciero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: cajasData, error: errCajas }, { data: movData, error: errMov }] = await Promise.all([
      supabase.from('cajas').select('*'),
      supabase
        .from('movimientos_financieros')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    // Si el usuario es 'empleado', RLS ya filtra filas de caja 'personal' automáticamente.
    if (errCajas) setError(errCajas.message);
    else setCajas(cajasData as Caja[]);

    if (errMov) setError(errMov.message);
    else setMovimientos(movData as MovimientoFinanciero[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function saldoDe(tipo: CajaDestino): number {
    return cajas.find((c) => c.tipo === tipo)?.saldo_actual ?? 0;
  }

  // Registra un movimiento manual (gasto o ingreso extra) en cualquiera de las dos cajas.
  // Este es el punto único para "gastos" e "ingresos extra" del módulo Finanzas
  // (las ventas NUNCA pasan por aquí: siempre van a caja empresa vía trigger de BD).
  async function registrarMovimientoManual(
    caja: CajaDestino,
    tipo: 'ingreso' | 'egreso',
    monto: number,
    categoria: string,
    descripcion: string
  ) {
    const caja_id = cajas.find((c) => c.tipo === caja)?.id;
    if (!caja_id) throw new Error('Caja no encontrada');

    const { error: errMov } = await supabase.from('movimientos_financieros').insert({
      caja_id,
      tipo,
      monto,
      categoria,
      descripcion,
    });
    if (errMov) throw new Error(errMov.message);

    const nuevoSaldo = tipo === 'ingreso' ? saldoDe(caja) + monto : saldoDe(caja) - monto;
    const { error: errUpdate } = await supabase
      .from('cajas')
      .update({ saldo_actual: nuevoSaldo })
      .eq('id', caja_id);
    if (errUpdate) throw new Error(errUpdate.message);

    await fetchAll();
  }

  // Transferencia interna dueño Empresa -> Personal (retiro) o viceversa (aporte).
  // Es la ÚNICA vía permitida de mover dinero entre cajas, dejando rastro auditable.
  async function transferirEntreCajas(origen: CajaDestino, destino: CajaDestino, monto: number, descripcion: string) {
    if (origen === destino) throw new Error('Origen y destino no pueden ser iguales');

    const cajaOrigenId = cajas.find((c) => c.tipo === origen)?.id;
    const cajaDestinoId = cajas.find((c) => c.tipo === destino)?.id;
    if (!cajaOrigenId || !cajaDestinoId) throw new Error('Caja no encontrada');

    const { error: errOrigen } = await supabase.from('movimientos_financieros').insert({
      caja_id: cajaOrigenId,
      tipo: 'transferencia_interna',
      monto,
      categoria: `transferencia_a_${destino}`,
      descripcion,
    });
    if (errOrigen) throw new Error(errOrigen.message);

    const { error: errDestino } = await supabase.from('movimientos_financieros').insert({
      caja_id: cajaDestinoId,
      tipo: 'transferencia_interna',
      monto,
      categoria: `transferencia_desde_${origen}`,
      descripcion,
    });
    if (errDestino) throw new Error(errDestino.message);

    await supabase.from('cajas').update({ saldo_actual: saldoDe(origen) - monto }).eq('id', cajaOrigenId);
    await supabase.from('cajas').update({ saldo_actual: saldoDe(destino) + monto }).eq('id', cajaDestinoId);

    await fetchAll();
  }

  return {
    cajas,
    movimientos,
    loading,
    error,
    saldoDe,
    registrarMovimientoManual,
    transferirEntreCajas,
    refetch: fetchAll,
  };
}

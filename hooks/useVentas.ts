import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CajaDestino, Venta, VentaItemInput } from '@/types/database';

export function useVentas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVentas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) setError(error.message);
    else setVentas(data as Venta[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVentas();
  }, [fetchVentas]);

  // Los triggers procesar_venta_item y procesar_venta_financiero
  // (definidos en la BD) descuentan stock e insertan el movimiento
  // financiero automáticamente al insertar en ventas/venta_items.
  async function crearVenta(
    clienteId: number,
    items: VentaItemInput[],
    cajaDestino: CajaDestino = 'empresa'
  ) {
    if (items.length === 0) throw new Error('La venta necesita al menos un producto');

    const total = items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);

    const { data: ventaData, error: errVenta } = await supabase
      .from('ventas')
      .insert({ cliente_id: clienteId, total, caja_destino: cajaDestino, estado: 'completada' })
      .select()
      .single();

    if (errVenta) throw new Error(errVenta.message);

    const itemsPayload = items.map((it) => ({ ...it, venta_id: ventaData.id }));
    const { error: errItems } = await supabase.from('venta_items').insert(itemsPayload);

    if (errItems) {
      // Rollback manual de la venta si fallan los items (Supabase JS no soporta transacciones multi-tabla)
      await supabase.from('ventas').delete().eq('id', ventaData.id);
      throw new Error(errItems.message);
    }

    await fetchVentas();
    return ventaData as Venta;
  }

  async function cancelarVenta(ventaId: number) {
    const { error } = await supabase.from('ventas').update({ estado: 'cancelada' }).eq('id', ventaId);
    if (error) throw new Error(error.message);
    await fetchVentas();
    // Nota: cancelar no revierte stock automáticamente por diseño;
    // hacer un ajuste manual en Inventario si corresponde.
  }

  return { ventas, loading, error, crearVenta, cancelarVenta, refetch: fetchVentas };
}

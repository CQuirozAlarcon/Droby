import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CajaDestino, Venta, VentaItemInput } from '@/types/database';

// select con joins: trae el nombre del cliente y, por cada item, el modelo/tipo
// del producto — necesario para mostrar "Venta a {cliente}" en la lista y el
// detalle completo (qué modelos se vendieron) en la pantalla de detalle.
const SELECT_VENTA_COMPLETA = '*, clientes(nombre), venta_items(*, productos(modelo, tipo, variante))';

export function useVentas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVentas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ventas')
      .select(SELECT_VENTA_COMPLETA)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) setError(error.message);
    else {
      setVentas(data as unknown as Venta[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVentas();
  }, [fetchVentas]);

  // La creación y cancelación van por RPC transaccional en la BD:
  // validan stock, calculan el total en servidor y todo ocurre en una
  // sola transacción (si algo falla, nada queda a medias — antes el
  // rollback manual dejaba dinero fantasma en caja).
  async function crearVenta(
    clienteId: number,
    items: VentaItemInput[],
    cajaDestino: CajaDestino = 'empresa'
  ) {
    if (items.length === 0) throw new Error('La venta necesita al menos un producto');

    const { data: ventaId, error } = await supabase.rpc('crear_venta', {
      p_cliente_id: clienteId,
      p_items: items,
      p_caja_destino: cajaDestino,
    });
    if (error) throw new Error(error.message);

    await fetchVentas();
    const venta = await obtenerVentaPorId(ventaId as number);
    if (!venta) throw new Error('La venta se creó pero no se pudo recargar');
    return venta;
  }

  // Cancelar revierte automáticamente el stock y el ingreso en caja
  // (trigger revertir_venta_cancelada en la BD).
  async function cancelarVenta(ventaId: number) {
    const { error } = await supabase.rpc('cancelar_venta', { p_venta_id: ventaId });
    if (error) throw new Error(error.message);
    await fetchVentas();
  }

  async function obtenerVentaPorId(ventaId: number): Promise<Venta | null> {
    const { data, error } = await supabase
      .from('ventas')
      .select(SELECT_VENTA_COMPLETA)
      .eq('id', ventaId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as Venta | null;
  }

  function nombreVenta(venta: Venta): string {
    return venta.clientes?.nombre ? `Venta a ${venta.clientes.nombre}` : `Venta #${venta.id}`;
  }

  return { ventas, loading, error, crearVenta, cancelarVenta, obtenerVentaPorId, nombreVenta, refetch: fetchVentas };
}

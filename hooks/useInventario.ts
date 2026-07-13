import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Producto, TipoProducto } from '@/types/database';

export function useInventario() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelNameRef = useRef(`productos-realtime-${Math.random().toString(36).slice(2)}`);

  const fetchProductos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('tipo', { ascending: true })
      .order('modelo', { ascending: true });

    if (error) setError(error.message);
    else setProductos(data as Producto[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProductos();

    // Realtime: refleja cambios de stock hechos desde otro dispositivo/operador.
    // Nombre de canal único por instancia: evita el error "cannot add postgres_changes
    // callbacks after subscribe()" que ocurre si dos pantallas montan este hook a la vez
    // e intentan reutilizar el mismo nombre de canal ya suscrito.
    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'productos' },
        () => fetchProductos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProductos]);

  const productosStockBajo = productos.filter((p) => p.stock_actual < p.stock_minimo);

  async function crearProducto(input: {
    tipo: TipoProducto;
    modelo: string;
    variante?: string | null;
    stock_actual: number;
    stock_minimo?: number;
    precio_unitario: number;
    costo_unitario: number;
  }) {
    const { error } = await supabase.from('productos').insert(input);
    if (error) throw new Error(error.message);
    await fetchProductos();
  }

  async function ajustarStock(productoId: number, cantidad: number, nota: string, operadorId?: number) {
    // cantidad puede ser positiva (entrada) o negativa (salida/ajuste)
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) throw new Error('Producto no encontrado');

    const { error: errUpdate } = await supabase
      .from('productos')
      .update({ stock_actual: producto.stock_actual + cantidad })
      .eq('id', productoId);
    if (errUpdate) throw new Error(errUpdate.message);

    const { error: errMov } = await supabase.from('movimientos_inventario').insert({
      producto_id: productoId,
      tipo_movimiento: cantidad >= 0 ? 'entrada' : 'ajuste',
      cantidad: Math.abs(cantidad),
      nota,
      operador_id: operadorId ?? null,
    });
    if (errMov) throw new Error(errMov.message);

    await fetchProductos();
  }

  async function actualizarProducto(
    productoId: number,
    cambios: Partial<{
      modelo: string;
      variante: string | null;
      precio_unitario: number;
      costo_unitario: number;
      stock_minimo: number;
    }>
  ) {
    const { error } = await supabase.from('productos').update(cambios).eq('id', productoId);
    if (error) throw new Error(error.message);
    await fetchProductos();
  }

  function buscarPorModelo(modelo: string): Producto | undefined {
    return productos.find((p) => p.modelo.toLowerCase() === modelo.toLowerCase());
  }

  return {
    productos,
    productosStockBajo,
    loading,
    error,
    crearProducto,
    ajustarStock,
    actualizarProducto,
    buscarPorModelo,
    refetch: fetchProductos,
  };
}

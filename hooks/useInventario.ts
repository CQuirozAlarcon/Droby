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
    else {
      setProductos(data as Producto[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProductos();
    const channel = supabase
      .channel(channelNameRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => fetchProductos())
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

  // UPDATE relativo atómico en la BD (stock_actual = stock_actual + cantidad):
  // antes se leía el stock del estado local y se reescribía, lo que perdía
  // unidades cuando dos operaciones corrían en paralelo.
  async function ajustarStock(productoId: number, cantidad: number, nota: string, operadorId?: number) {
    const { error } = await supabase.rpc('ajustar_stock', {
      p_producto_id: productoId,
      p_cantidad: cantidad,
      p_nota: nota,
      p_operador_id: operadorId ?? null,
    });
    if (error) throw new Error(error.message);
    await fetchProductos();
  }

  async function actualizarProducto(
    productoId: number,
    cambios: Partial<{
      modelo: string; variante: string | null; precio_unitario: number; costo_unitario: number; stock_minimo: number;
    }>
  ) {
    const { error } = await supabase.from('productos').update(cambios).eq('id', productoId);
    if (error) throw new Error(error.message);
    await fetchProductos();
  }

  // Devuelve TODOS los productos de un modelo (puede haber funda y cargador
  // del mismo iPhone): el caller decide cómo desambiguar en vez de vender
  // el producto equivocado por orden alfabético.
  function buscarProductosPorModelo(modelo: string, tipo?: TipoProducto): Producto[] {
    const m = modelo.trim().toLowerCase();
    return productos.filter((p) => p.modelo.toLowerCase() === m && (!tipo || p.tipo === tipo));
  }

  return {
    productos, productosStockBajo, loading, error,
    crearProducto, ajustarStock, actualizarProducto, buscarProductosPorModelo, refetch: fetchProductos,
  };
}

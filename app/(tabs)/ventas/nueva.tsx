import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useInventario } from '@/hooks/useInventario';
import { useVentas } from '@/hooks/useVentas';
import { useConsignaciones } from '@/hooks/useConsignaciones';
import { supabase } from '@/lib/supabase';
import { Cliente, Producto } from '@/types/database';
import { showAlert } from '@/lib/alert';
import { ClienteAutocomplete } from '@/components/ClienteAutocomplete';
import { DateField } from '@/components/DateField';
import { fechaLocalISO } from '@/lib/fecha';
import { CasesPalette } from '@/components/ventas/CasesPalette';
import { CargadoresGrid } from '@/components/ventas/CargadoresGrid';

// ---------------------------------------------------------------------------
// Nueva venta / consignación — PALETA RÁPIDA DE VENTAS (POS).
//
// El vendedor elige productos como en una paleta:
//   • 📱 Cases: matriz modelo × color con modo AGRUPADO (lotes masivos con
//     "Aplicar a todos") y modo POR MODELO (pestañas con cantidades exactas
//     que persisten al navegar).
//   • 🔌 Cargadores: cuadrícula simple con +/− e ingreso directo.
// El carrito lista lo seleccionado y permite ajustar el precio unitario por
// línea (descuentos a algunos clientes) antes de confirmar.
// ---------------------------------------------------------------------------

type TipoOperacion = 'venta' | 'consignacion';
type Categoria = 'cases' | 'cargadores';

export default function NuevaVentaScreen() {
  const router = useRouter();
  const { productos, loading } = useInventario();
  const { crearVenta } = useVentas();
  const { crearConsignacion } = useConsignaciones();
  // Si se llega desde la ficha de un cliente (botón "+ Nueva venta"), el
  // cliente viene pre-seleccionado para no obligar a re-buscarlo.
  const { clienteId: clienteIdParam, clienteNombre: clienteNombreParam } = useLocalSearchParams<{
    clienteId?: string;
    clienteNombre?: string;
  }>();

  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacion>('venta');
  const [categoria, setCategoria] = useState<Categoria>('cases');
  const [clienteNombre, setClienteNombre] = useState(clienteNombreParam ?? '');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [clientePrecargado, setClientePrecargado] = useState(false);
  const [fechaLimite, setFechaLimite] = useState<Date | null>(null);

  // Fuente de verdad de la paleta: productoId → cantidad (0 = sin pedir).
  // Compartida por Cases y Cargadores, sobrevive al cambiar de pestaña.
  const [seleccion, setSeleccion] = useState<Record<number, number>>({});
  // Precio unitario por línea, como texto para poder editar cómodo. Si no
  // está, se usa el precio fijo de catálogo del producto.
  const [precios, setPrecios] = useState<Record<number, string>>({});
  const [guardando, setGuardando] = useState(false);

  // Si llegamos con clienteId en params, hidrata clienteSeleccionado una vez
  // (necesitamos el objeto Cliente completo para evitar el SELECT extra al
  // confirmar — el nombre solo no alcanza para `obtenerOCrearCliente`).
  useEffect(() => {
    if (clientePrecargado || !clienteIdParam) return;
    const id = parseInt(clienteIdParam, 10);
    if (Number.isNaN(id)) return;
    supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn('No se pudo precargar el cliente:', error.message);
          return;
        }
        if (data) {
          setClienteSeleccionado(data as Cliente);
          setClienteNombre((data as Cliente).nombre);
        }
        setClientePrecargado(true);
      });
  }, [clienteIdParam, clientePrecargado]);

  const fundas = useMemo(() => productos.filter((p) => p.tipo === 'funda'), [productos]);
  const cargadores = useMemo(() => productos.filter((p) => p.tipo === 'cargador'), [productos]);

  function onSetCantidad(productoId: number, cantidad: number) {
    setSeleccion((prev) => ({ ...prev, [productoId]: cantidad }));
  }

  function precioDe(producto: Producto): number {
    const texto = precios[producto.id];
    if (texto === undefined) return producto.precio_unitario;
    const valor = parseFloat(texto);
    return Number.isFinite(valor) && valor > 0 ? valor : producto.precio_unitario;
  }

  // Carrito derivado de la selección: cada línea guarda el producto completo.
  const itemsCarrito = useMemo(
    () =>
      productos
        .filter((p) => (seleccion[p.id] ?? 0) > 0)
        .map((p) => ({ producto: p, cantidad: seleccion[p.id] })),
    [productos, seleccion]
  );

  const total = itemsCarrito.reduce((acc, it) => acc + it.cantidad * precioDe(it.producto), 0);
  const unidades = itemsCarrito.reduce((acc, it) => acc + it.cantidad, 0);

  function quitarItem(productoId: number) {
    onSetCantidad(productoId, 0);
    setPrecios((prev) => {
      const copia = { ...prev };
      delete copia[productoId];
      return copia;
    });
  }

  async function obtenerOCrearCliente(): Promise<number> {
    if (clienteSeleccionado && clienteSeleccionado.nombre.toLowerCase() === clienteNombre.trim().toLowerCase()) {
      return clienteSeleccionado.id;
    }
    const { data: existente } = await supabase
      .from('clientes')
      .select('id')
      .ilike('nombre', clienteNombre.trim())
      .maybeSingle();

    if (existente?.id) return existente.id;

    const { data: nuevo, error } = await supabase
      .from('clientes')
      .insert({ nombre: clienteNombre.trim(), tipo_cliente: 'mayorista' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return nuevo.id;
  }

  async function handleConfirmar() {
    if (!clienteNombre.trim()) {
      showAlert('Falta el cliente', 'Ingresa el nombre del cliente');
      return;
    }
    if (itemsCarrito.length === 0) {
      showAlert('Pedido vacío', 'Elige al menos un producto de la paleta');
      return;
    }

    // Alerta visual de stock: bloquea antes de llegar al servidor (que
    // igualmente re-valida dentro de la transacción).
    const excedido = itemsCarrito.find((it) => it.cantidad > it.producto.stock_actual);
    if (excedido) {
      showAlert(
        'Stock insuficiente',
        `${excedido.producto.modelo}${excedido.producto.variante ? ` · ${excedido.producto.variante}` : ''}: pediste ${excedido.cantidad} y solo hay ${excedido.producto.stock_actual}`
      );
      return;
    }

    setGuardando(true);
    try {
      const clienteId = await obtenerOCrearCliente();
      const itemsPayload = itemsCarrito.map((it) => ({
        producto_id: it.producto.id,
        cantidad: it.cantidad,
        precio_unitario: precioDe(it.producto),
      }));

      if (tipoOperacion === 'venta') {
        await crearVenta(clienteId, itemsPayload, 'empresa');
        showAlert('Venta registrada', `Total: S/ ${total.toFixed(2)}`);
        router.back();
      } else {
        await crearConsignacion(clienteId, itemsPayload, fechaLimite ? fechaLocalISO(fechaLimite) : null, 'empresa');
        showAlert('Consignación registrada', `Se entregó mercadería por S/ ${total.toFixed(2)}. Queda como cuenta por cobrar hasta que se registre el pago.`);
        router.replace('/ventas/consignaciones');
      }
      setSeleccion({});
      setPrecios({});
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.tipoRow}>
          {(['venta', 'consignacion'] as const).map((t) => (
            <Pressable key={t} style={[styles.tipoChip, tipoOperacion === t && styles.tipoChipActive]} onPress={() => setTipoOperacion(t)}>
              <Text style={[styles.tipoChipText, tipoOperacion === t && styles.tipoChipTextActive]}>
                {t === 'venta' ? '💰 Venta normal' : '📑 Consignación'}
              </Text>
            </Pressable>
          ))}
        </View>
        {tipoOperacion === 'consignacion' && (
          <Text style={styles.hint}>
            La mercadería sale de inventario igual que una venta, pero el dinero no entra a caja todavía. Queda
            registrada como "Cuenta por cobrar" en Finanzas hasta que registres los pagos.
          </Text>
        )}

        <Text style={styles.label}>Cliente</Text>
        <ClienteAutocomplete
          value={clienteNombre}
          onChangeText={(t) => {
            setClienteNombre(t);
            setClienteSeleccionado(null);
          }}
          onSelectCliente={setClienteSeleccionado}
          placeholder="Nombre del cliente"
        />

        {tipoOperacion === 'consignacion' && (
          <>
            <Text style={styles.label}>Fecha límite de cobro (opcional)</Text>
            <DateField
              value={fechaLimite}
              onChange={setFechaLimite}
              placeholder="Sin fecha límite"
              minimumDate={new Date()}
              accessibilityLabel="Fecha límite de cobro"
              limpiable
            />
          </>
        )}

        <Text style={styles.sectionTitle}>Paleta de productos</Text>
        <View style={styles.categoriaRow}>
          <Pressable
            style={[styles.categoriaChip, categoria === 'cases' && styles.categoriaChipActive]}
            onPress={() => setCategoria('cases')}
            accessibilityRole="button"
            accessibilityLabel="Categoría cases, fundas"
            accessibilityState={{ selected: categoria === 'cases' }}
          >
            <Text style={[styles.categoriaChipText, categoria === 'cases' && styles.categoriaChipTextActive]}>
              📱 Cases
            </Text>
          </Pressable>
          <Pressable
            style={[styles.categoriaChip, categoria === 'cargadores' && styles.categoriaChipActive]}
            onPress={() => setCategoria('cargadores')}
            accessibilityRole="button"
            accessibilityLabel="Categoría cargadores"
            accessibilityState={{ selected: categoria === 'cargadores' }}
          >
            <Text style={[styles.categoriaChipText, categoria === 'cargadores' && styles.categoriaChipTextActive]}>
              🔌 Cargadores
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <Text style={styles.hint}>Cargando catálogo…</Text>
        ) : categoria === 'cases' ? (
          <CasesPalette fundas={fundas} seleccion={seleccion} onSetCantidad={onSetCantidad} />
        ) : (
          <CargadoresGrid cargadores={cargadores} seleccion={seleccion} onSetCantidad={onSetCantidad} />
        )}

        <Text style={styles.sectionTitle}>Pedido ({unidades} unidades)</Text>
        <Text style={styles.hintSmall}>
          El precio viene automático del catálogo — puedes modificarlo por línea para dejarlo menor a algunos clientes.
        </Text>

        {itemsCarrito.length > 0 && (
          <FlatList
            data={itemsCarrito}
            scrollEnabled={false}
            keyExtractor={(item) => String(item.producto.id)}
            renderItem={({ item }) => {
              const excede = item.cantidad > item.producto.stock_actual;
              return (
                <View style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemText}>
                      {item.cantidad} × {item.producto.modelo}
                      {item.producto.variante ? ` · ${item.producto.variante}` : ''}
                    </Text>
                    <View style={styles.precioRow}>
                      <Text style={styles.precioLabel}>S/</Text>
                      <TextInput
                        style={[styles.precioInput, excede && styles.precioInputExcede]}
                        keyboardType="decimal-pad"
                        value={precios[item.producto.id] ?? String(item.producto.precio_unitario)}
                        onChangeText={(t) =>
                          setPrecios((prev) => ({ ...prev, [item.producto.id]: t.replace(/[^0-9.,]/g, '').replace(',', '.') }))
                        }
                        accessibilityLabel={`Precio unitario de ${item.producto.modelo}`}
                      />
                      <Text style={styles.itemSubtotal}>
                        = S/ {(item.cantidad * precioDe(item.producto)).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => quitarItem(item.producto.id)} accessibilityRole="button" accessibilityLabel={`Quitar ${item.producto.modelo} del pedido`}>
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                </View>
              );
            }}
          />
        )}

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>S/ {total.toFixed(2)}</Text>
        </View>

        <Pressable
          style={styles.confirmButton}
          onPress={handleConfirmar}
          disabled={guardando}
          accessibilityRole="button"
          accessibilityLabel={tipoOperacion === 'venta' ? 'Confirmar venta' : 'Confirmar consignación'}
          accessibilityState={{ busy: guardando }}
        >
          <Text style={styles.confirmText}>
            {guardando ? 'Guardando...' : tipoOperacion === 'venta' ? 'Confirmar venta' : 'Confirmar consignación'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xs },
  tipoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tipoChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  tipoChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tipoChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tipoChipTextActive: { color: colors.bg },
  label: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  hintSmall: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: spacing.md },
  categoriaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  categoriaChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  categoriaChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoriaChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  categoriaChipTextActive: { color: colors.bg },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.xs, gap: spacing.sm },
  itemText: { color: colors.text, fontSize: 13 },
  precioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  precioLabel: { color: colors.textMuted, fontSize: 12 },
  precioInput: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 2, minWidth: 72, fontSize: 13 },
  precioInputExcede: { borderColor: colors.danger },
  itemSubtotal: { color: colors.textMuted, fontSize: 13 },
  remove: { color: colors.danger, fontWeight: '700', paddingHorizontal: spacing.xs },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  totalLabel: { color: colors.textMuted, fontSize: 14 },
  totalValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  confirmButton: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  confirmText: { color: colors.bg, fontWeight: '700' },
});

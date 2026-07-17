import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useInventario } from '@/hooks/useInventario';
import { useVentas } from '@/hooks/useVentas';
import { supabase } from '@/lib/supabase';
import { Cliente, VentaItemInput } from '@/types/database';
import { showAlert } from '@/lib/alert';
import { Select } from '@/components/Select';
import { ClienteAutocomplete } from '@/components/ClienteAutocomplete';

interface ItemCarrito extends VentaItemInput {
  modelo: string;
}

export default function NuevaVentaScreen() {
  const router = useRouter();
  const { productos } = useInventario();
  const { crearVenta } = useVentas();

  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [productoSeleccionado, setProductoSeleccionado] = useState<number | null>(
    productos[0]?.id ?? null
  );
  const [cantidad, setCantidad] = useState('');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const producto = productos.find((p) => p.id === productoSeleccionado);
    if (producto) setPrecioUnitario(String(producto.precio_unitario));
  }, [productoSeleccionado, productos]);

  useEffect(() => {
    if (productoSeleccionado === null && productos.length > 0) {
      setProductoSeleccionado(productos[0].id);
    }
  }, [productos, productoSeleccionado]);

  const total = items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);

  function agregarItem() {
    const cant = parseInt(cantidad, 10);
    const precio = parseFloat(precioUnitario);
    const producto = productos.find((p) => p.id === productoSeleccionado);
    if (!producto || !cant || cant <= 0) {
      showAlert('Datos inválidos', 'Selecciona un producto y una cantidad válida');
      return;
    }
    if (!precio || precio <= 0) {
      showAlert('Precio inválido', 'Ingresa un precio unitario válido');
      return;
    }
    if (cant > producto.stock_actual) {
      showAlert('Stock insuficiente', `Solo hay ${producto.stock_actual} unidades de ${producto.modelo}`);
      return;
    }
    setItems((prev) => [
      ...prev,
      { producto_id: producto.id, modelo: producto.modelo, cantidad: cant, precio_unitario: precio },
    ]);
    setCantidad('');
  }

  function quitarItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleConfirmar() {
    if (!clienteNombre.trim()) {
      showAlert('Falta el cliente', 'Ingresa el nombre del cliente');
      return;
    }
    if (items.length === 0) {
      showAlert('Carrito vacío', 'Agrega al menos un producto');
      return;
    }

    setGuardando(true);
    try {
      let clienteId = clienteSeleccionado?.id;
      if (!clienteId) {
        const { data: existente } = await supabase
          .from('clientes')
          .select('id')
          .ilike('nombre', clienteNombre.trim())
          .maybeSingle();

        clienteId = existente?.id;
        if (!clienteId) {
          const { data: nuevo, error: errCliente } = await supabase
            .from('clientes')
            .insert({ nombre: clienteNombre.trim(), tipo_cliente: 'mayorista' })
            .select()
            .single();
          if (errCliente) throw new Error(errCliente.message);
          clienteId = nuevo.id;
        }
      }

      await crearVenta(
        clienteId,
        items.map(({ modelo, ...rest }) => rest),
        'empresa'
      );

      showAlert('Venta registrada', `Total: S/ ${total.toFixed(2)}`);
      router.back();
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Cliente</Text>
        <ClienteAutocomplete
          value={clienteNombre}
          onChangeText={(t) => {
            setClienteNombre(t);
            setClienteSeleccionado(null);
          }}
          onSelect={setClienteSeleccionado}
        />

        <Text style={styles.sectionTitle}>Agregar productos por modelo</Text>
        <Text style={styles.hint}>
          Cuenta manualmente las unidades por modelo (sin distinguir color), tal como se hace hoy con el pedido del cliente.
        </Text>

        <Select
          value={productoSeleccionado}
          onChange={setProductoSeleccionado}
          searchable
          placeholder="Selecciona un producto"
          options={productos.map((p) => ({
            label: `${p.modelo}${p.variante ? ' · ' + p.variante : ''}`,
            value: p.id,
            subtitle: `Stock: ${p.stock_actual}`,
          }))}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Cantidad</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={cantidad}
              onChangeText={setCantidad}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Precio unitario (S/)</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={precioUnitario}
              onChangeText={setPrecioUnitario}
            />
          </View>
        </View>
        <Text style={styles.hintSmall}>El precio ya viene prellenado con el precio de lista — puedes cambiarlo para aplicar un descuento a este cliente.</Text>

        <Pressable style={styles.addButton} onPress={agregarItem}>
          <Text style={styles.addButtonText}>Agregar al pedido</Text>
        </Pressable>

        {items.length > 0 && (
          <FlatList
            data={items}
            scrollEnabled={false}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item, index }) => (
              <View style={styles.itemRow}>
                <Text style={styles.itemText}>
                  {item.cantidad} × {item.modelo} (S/ {item.precio_unitario.toFixed(2)} c/u)
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={styles.itemSubtotal}>S/ {(item.cantidad * item.precio_unitario).toFixed(2)}</Text>
                  <Pressable onPress={() => quitarItem(index)}>
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>S/ {total.toFixed(2)}</Text>
        </View>

        <Pressable style={styles.confirmButton} onPress={handleConfirmar} disabled={guardando}>
          <Text style={styles.confirmText}>{guardando ? 'Guardando...' : 'Confirmar venta'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  fieldLabel: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  hintSmall: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: spacing.md },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', gap: spacing.sm },
  addButton: { backgroundColor: colors.success, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  addButtonText: { color: '#0F172A', fontWeight: '700' },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.xs,
  },
  itemText: { color: colors.text, fontSize: 13, flex: 1, marginRight: spacing.sm },
  itemSubtotal: { color: colors.textMuted, fontSize: 13 },
  remove: { color: colors.danger, fontWeight: '700', paddingHorizontal: spacing.xs },
  totalBox: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg,
  },
  totalLabel: { color: colors.textMuted, fontSize: 14 },
  totalValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  confirmButton: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  confirmText: { color: colors.bg, fontWeight: '700' },
});
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useInventario } from '@/hooks/useInventario';
import { showAlert } from '@/lib/alert';

export default function DetalleProductoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { productos, ajustarStock, actualizarProducto } = useInventario();
  const producto = productos.find((p) => p.id === Number(id));

  const [cantidad, setCantidad] = useState('');
  const [nota, setNota] = useState('');
  const [procesando, setProcesando] = useState(false);

  const [editando, setEditando] = useState(false);
  const [modeloEdit, setModeloEdit] = useState(producto?.modelo ?? '');
  const [varianteEdit, setVarianteEdit] = useState(producto?.variante ?? '');
  const [precioEdit, setPrecioEdit] = useState(String(producto?.precio_unitario ?? ''));
  const [costoEdit, setCostoEdit] = useState(String(producto?.costo_unitario ?? ''));
  const [stockMinimoEdit, setStockMinimoEdit] = useState(String(producto?.stock_minimo ?? ''));
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  if (!producto) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Producto no encontrado</Text>
      </View>
    );
  }

  function iniciarEdicion() {
    setModeloEdit(producto!.modelo);
    setVarianteEdit(producto!.variante ?? '');
    setPrecioEdit(String(producto!.precio_unitario));
    setCostoEdit(String(producto!.costo_unitario));
    setStockMinimoEdit(String(producto!.stock_minimo));
    setEditando(true);
  }

  async function guardarEdicion() {
    if (!modeloEdit.trim()) return showAlert('El modelo no puede estar vacío');
    const precioNum = parseFloat(precioEdit);
    const costoNum = parseFloat(costoEdit);
    const stockMinNum = parseInt(stockMinimoEdit, 10);
    if (!precioNum || !costoNum) return showAlert('Precio y costo deben ser números válidos');

    setGuardandoEdicion(true);
    try {
      await actualizarProducto(producto!.id, {
        modelo: modeloEdit.trim(), variante: varianteEdit.trim() || null,
        precio_unitario: precioNum, costo_unitario: costoNum, stock_minimo: stockMinNum || 0,
      });
      setEditando(false);
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function ajustar(signo: 1 | -1) {
    const cant = parseInt(cantidad, 10);
    if (!cant || cant <= 0) {
      showAlert('Cantidad inválida', 'Ingresa un número mayor a 0');
      return;
    }
    setProcesando(true);
    try {
      await ajustarStock(producto!.id, cant * signo, nota || (signo === 1 ? 'Entrada manual' : 'Salida/ajuste manual'));
      setCantidad('');
      setNota('');
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setProcesando(false);
    }
  }

  if (editando) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Text style={styles.sectionTitle}>Editar producto</Text>
        <Text style={styles.fieldLabel}>Modelo</Text>
        <TextInput style={styles.input} value={modeloEdit} onChangeText={setModeloEdit} placeholderTextColor={colors.textMuted} />
        <Text style={styles.fieldLabel}>Variante</Text>
        <TextInput style={styles.input} value={varianteEdit} onChangeText={setVarianteEdit} placeholderTextColor={colors.textMuted} />
        <Text style={styles.fieldLabel}>Precio de venta (S/)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={precioEdit} onChangeText={setPrecioEdit} />
        <Text style={styles.fieldLabel}>Costo unitario (S/)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={costoEdit} onChangeText={setCostoEdit} />
        <Text style={styles.fieldLabel}>Stock mínimo (alerta)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={stockMinimoEdit} onChangeText={setStockMinimoEdit} />
        <View style={styles.row}>
          <Pressable style={[styles.actionButton, { backgroundColor: colors.border }]} onPress={() => setEditando(false)}>
            <Text style={styles.actionText}>Cancelar</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={guardarEdicion} disabled={guardandoEdicion}>
            <Text style={styles.actionText}>{guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.modelo}>{producto.modelo}</Text>
          <Text style={styles.sub}>{producto.tipo === 'funda' ? 'Funda' : 'Cargador'} {producto.variante ? `· ${producto.variante}` : ''}</Text>
        </View>
        <Pressable style={styles.editButton} onPress={iniciarEdicion}>
          <Text style={styles.editButtonText}>Editar</Text>
        </Pressable>
      </View>

      <View style={styles.stockCard}>
        <Text style={styles.stockValue}>{producto.stock_actual}</Text>
        <Text style={styles.stockLabel}>unidades en stock (mínimo: {producto.stock_minimo})</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Precio venta</Text>
          <Text style={styles.priceValue}>S/ {producto.precio_unitario.toFixed(2)}</Text>
        </View>
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Costo</Text>
          <Text style={styles.priceValue}>S/ {producto.costo_unitario.toFixed(2)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Ajustar stock</Text>
      <TextInput style={styles.input} placeholder="Cantidad" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={cantidad} onChangeText={setCantidad} />
      <TextInput style={styles.input} placeholder="Nota (ej. compra a proveedor, merma, etc.)" placeholderTextColor={colors.textMuted} value={nota} onChangeText={setNota} />

      <View style={styles.row}>
        <Pressable style={[styles.actionButton, { backgroundColor: colors.success }]} onPress={() => ajustar(1)} disabled={procesando}>
          <Text style={styles.actionText}>+ Entrada</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, { backgroundColor: colors.danger }]} onPress={() => ajustar(-1)} disabled={procesando}>
          <Text style={styles.actionText}>− Salida</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  notFound: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  modelo: { color: colors.text, fontSize: 24, fontWeight: '700' },
  sub: { color: colors.textMuted, marginBottom: spacing.md },
  editButton: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.border },
  editButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  stockCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  stockValue: { color: colors.text, fontSize: 40, fontWeight: '800' },
  stockLabel: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  priceCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  priceLabel: { color: colors.textMuted, fontSize: 12 },
  priceValue: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing.xs },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  fieldLabel: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  actionButton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  actionText: { color: '#0F172A', fontWeight: '700' },
});

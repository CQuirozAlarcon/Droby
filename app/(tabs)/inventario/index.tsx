import { useMemo, useState } from 'react';
import { View, FlatList, TextInput, StyleSheet, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useInventario } from '@/hooks/useInventario';
import { useFocusRefetch } from '@/hooks/useFocusRefetch';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState } from '@/components/EmptyState';
import { TipoProducto } from '@/types/database';

export default function InventarioScreen() {
  const router = useRouter();
  const { productos, loading, refetch } = useInventario();
  // al volver de crear/editar un producto, la lista se refresca sola
  useFocusRefetch(refetch);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<TipoProducto | 'todos'>('todos');

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideTipo = filtro === 'todos' || p.tipo === filtro;
      const coincideBusqueda = p.modelo.toLowerCase().includes(busqueda.toLowerCase());
      return coincideTipo && coincideBusqueda;
    });
  }, [productos, busqueda, filtro]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <Pressable style={styles.gestorBanner} onPress={() => router.push('/inventario/matricial')} accessibilityRole="button" accessibilityLabel="Gestionar cases en vista matricial">
        <Text style={styles.gestorEmoji}>📱</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.gestorTitulo}>Cases — vista matricial</Text>
          <Text style={styles.gestorDesc}>Ingresar mercadería cruzando modelos × colores</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable style={[styles.gestorBanner, { borderLeftColor: colors.empresa }]} onPress={() => router.push('/inventario/cargadores')} accessibilityRole="button" accessibilityLabel="Gestionar cargadores en vista de lista">
        <Text style={styles.gestorEmoji}>🔌</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.gestorTitulo}>Cargadores — vista de lista</Text>
          <Text style={styles.gestorDesc}>Actualizar el stock del catálogo de cargadores</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <TextInput
        style={styles.search}
        placeholder="Buscar por modelo..."
        placeholderTextColor={colors.textMuted}
        value={busqueda}
        onChangeText={setBusqueda}
      />

      <View style={styles.filterRow}>
        {(['todos', 'funda', 'cargador'] as const).map((t) => (
          <Pressable key={t} style={[styles.filterChip, filtro === t && styles.filterChipActive]} onPress={() => setFiltro(t)}>
            <Text style={[styles.filterText, filtro === t && styles.filterTextActive]}>
              {t === 'todos' ? 'Todos' : t === 'funda' ? 'Fundas' : 'Cargadores'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={productosFiltrados}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ProductCard producto={item} onPress={() => router.push(`/inventario/${item.id}`)} />}
        ListEmptyComponent={<EmptyState message={loading ? 'Cargando...' : 'No hay productos que coincidan'} />}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/inventario/nuevo')} accessibilityRole="button" accessibilityLabel="Agregar producto">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  gestorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  gestorEmoji: { fontSize: 24 },
  gestorTitulo: { color: colors.text, fontWeight: '700', fontSize: 14 },
  gestorDesc: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  chevron: { color: colors.textMuted, fontSize: 22 },
  search: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: 13 },
  filterTextActive: { color: colors.bg, fontWeight: '700' },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { color: colors.bg, fontSize: 28, fontWeight: '700', lineHeight: 30 },
});

import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useVentas } from '@/hooks/useVentas';
import { useFocusRefetch } from '@/hooks/useFocusRefetch';
import { EmptyState } from '@/components/EmptyState';

export default function VentasScreen() {
  const router = useRouter();
  const { ventas, loading, nombreVenta, refetch } = useVentas();
  // al volver de crear/cancelar una venta, la lista se refresca sola
  useFocusRefetch(refetch);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <Pressable style={styles.consignacionesBanner} onPress={() => router.push('/ventas/consignaciones')}>
        <Text style={styles.consignacionesEmoji}>📑</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.consignacionesTitulo}>Consignaciones</Text>
          <Text style={styles.consignacionesDesc}>Ver deudas por cobrar y registrar pagos</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <FlatList
        data={ventas}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/ventas/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.id}>{nombreVenta(item)}</Text>
              <Text style={styles.fecha}>{new Date(item.created_at).toLocaleString('es-PE')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.total}>S/ {item.total.toFixed(2)}</Text>
              <Text
                style={[
                  styles.estado,
                  item.estado === 'completada' && { color: colors.success },
                  item.estado === 'cancelada' && { color: colors.danger },
                ]}
              >
                {item.estado}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState message={loading ? 'Cargando...' : 'Aún no hay ventas registradas'} />}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/ventas/nueva')} accessibilityRole="button" accessibilityLabel="Nueva venta o consignación">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  consignacionesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.porCobrar,
  },
  consignacionesEmoji: { fontSize: 24 },
  consignacionesTitulo: { color: colors.text, fontWeight: '700', fontSize: 14 },
  consignacionesDesc: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  chevron: { color: colors.textMuted, fontSize: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  id: { color: colors.text, fontWeight: '700' },
  fecha: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  total: { color: colors.text, fontWeight: '700', fontSize: 16 },
  estado: { color: colors.textMuted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabText: { color: colors.bg, fontSize: 28, fontWeight: '700', lineHeight: 30 },
});

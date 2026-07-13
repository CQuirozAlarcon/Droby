import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useVentas } from '@/hooks/useVentas';
import { EmptyState } from '@/components/EmptyState';

export default function VentasScreen() {
  const router = useRouter();
  const { ventas, loading } = useVentas();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <FlatList
        data={ventas}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.id}>Venta #{item.id}</Text>
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
          </View>
        )}
        ListEmptyComponent={<EmptyState message={loading ? 'Cargando...' : 'Aún no hay ventas registradas'} />}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/ventas/nueva')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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

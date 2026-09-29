import { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useConsignaciones } from '@/hooks/useConsignaciones';
import { useFocusRefetch } from '@/hooks/useFocusRefetch';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { EstadoConsignacion } from '@/types/database';

const FILTROS: { valor: EstadoConsignacion | 'todas'; label: string }[] = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'pendiente', label: 'Pendientes' },
  { valor: 'parcial', label: 'Parciales' },
  { valor: 'liquidada', label: 'Liquidadas' },
];

export default function ConsignacionesScreen() {
  const router = useRouter();
  const { consignaciones, totalCuentasPorCobrar, loading, refetch } = useConsignaciones();
  // al volver de registrar un pago, saldos y estados se refrescan solos
  useFocusRefetch(refetch);
  const [filtro, setFiltro] = useState<EstadoConsignacion | 'todas'>('todas');

  const filtradas = useMemo(
    () => consignaciones.filter((c) => filtro === 'todas' || c.estado === filtro),
    [consignaciones, filtro]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <StatCard label="Total por cobrar (consignaciones activas)" valor={`S/ ${totalCuentasPorCobrar.toFixed(2)}`} color={colors.porCobrar} />

      <View style={styles.filterRow}>
        {FILTROS.map((f) => (
          <Pressable key={f.valor} style={[styles.filterChip, filtro === f.valor && styles.filterChipActive]} onPress={() => setFiltro(f.valor)}>
            <Text style={[styles.filterText, filtro === f.valor && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xl * 2 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/ventas/consignaciones/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cliente}>{item.clientes?.nombre ?? `Cliente #${item.cliente_id}`}</Text>
              <Text style={styles.fecha}>Entregada: {new Date(item.fecha_entrega).toLocaleDateString('es-PE')}</Text>
              {item.fecha_limite && <Text style={styles.fecha}>Límite de cobro: {item.fecha_limite}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.saldo}>S/ {Number(item.saldo_pendiente).toFixed(2)}</Text>
              <Text style={styles.saldoLabel}>por cobrar</Text>
              <View
                style={[
                  styles.estadoBadge,
                  item.estado === 'liquidada' && { backgroundColor: colors.success },
                  item.estado === 'parcial' && { backgroundColor: colors.warning },
                  item.estado === 'pendiente' && { backgroundColor: colors.porCobrar },
                ]}
              >
                <Text style={styles.estadoText}>{item.estado}</Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState message={loading ? 'Cargando...' : 'Sin consignaciones registradas'} />}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/ventas/nueva')} accessibilityRole="button" accessibilityLabel="Nueva venta o consignación">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: 13 },
  filterTextActive: { color: colors.bg, fontWeight: '700' },
  card: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  cliente: { color: colors.text, fontWeight: '700', fontSize: 15 },
  fecha: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  saldo: { color: colors.porCobrar, fontWeight: '800', fontSize: 16 },
  saldoLabel: { color: colors.textMuted, fontSize: 10 },
  estadoBadge: { marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.lg },
  estadoText: { color: '#0F172A', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
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

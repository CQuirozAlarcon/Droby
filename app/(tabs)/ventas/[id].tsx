import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useVentas } from '@/hooks/useVentas';
import { Venta } from '@/types/database';
import { showAlert, showConfirm } from '@/lib/alert';

export default function DetalleVentaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { obtenerVentaPorId, cancelarVenta, nombreVenta } = useVentas();
  const [venta, setVenta] = useState<Venta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    cargar();
  }, [id]);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerVentaPorId(Number(id));
      setVenta(data);
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setCargando(false);
    }
  }

  function handleCancelar() {
    if (!venta) return;
    showConfirm(
      'Cancelar venta',
      'La venta quedará anulada y se revertirá automáticamente: el stock vuelve al inventario y el ingreso se descuenta de la caja.',
      async () => {
        setCancelando(true);
        try {
          await cancelarVenta(venta.id);
          await cargar();
        } catch (e: any) {
          showAlert('Error', e.message);
        } finally {
          setCancelando(false);
        }
      }
    );
  }

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!venta) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Venta no encontrada</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{nombreVenta(venta)}</Text>
      <Text style={styles.fecha}>{new Date(venta.created_at).toLocaleString('es-PE')}</Text>

      <View style={styles.badgeRow}>
        <View
          style={[
            styles.estadoBadge,
            venta.estado === 'completada' && { backgroundColor: colors.success },
            venta.estado === 'cancelada' && { backgroundColor: colors.danger },
            venta.estado === 'pendiente' && { backgroundColor: colors.warning },
          ]}
        >
          <Text style={styles.estadoText}>{venta.estado}</Text>
        </View>
        <View style={styles.cajaBadge}>
          <Text style={styles.cajaText}>{venta.caja_destino === 'empresa' ? '🏢 Empresa' : '👤 Personal'}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Productos vendidos</Text>
      <FlatList
        data={venta.venta_items ?? []}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemModelo}>{item.productos?.modelo ?? 'Producto eliminado'}</Text>
              <Text style={styles.itemTipo}>
                {item.productos?.tipo === 'funda' ? 'Funda' : 'Cargador'}
                {item.productos?.variante ? ` · ${item.productos.variante}` : ''} · {item.cantidad} unid.
              </Text>
            </View>
            <Text style={styles.itemSubtotal}>S/ {item.subtotal.toFixed(2)}</Text>
          </View>
        )}
      />

      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>S/ {venta.total.toFixed(2)}</Text>
      </View>

      {venta.estado === 'completada' && (
        <Pressable
          style={styles.cancelarButton}
          onPress={handleCancelar}
          disabled={cancelando}
          accessibilityRole="button"
          accessibilityLabel="Cancelar venta. Revierte el stock y el ingreso en caja."
          accessibilityState={{ busy: cancelando }}
        >
          <Text style={styles.cancelarText}>{cancelando ? 'Cancelando...' : 'Cancelar venta'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  notFound: { color: colors.textMuted },
  titulo: { color: colors.text, fontSize: 22, fontWeight: '700' },
  fecha: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs, marginBottom: spacing.md },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  estadoBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg },
  estadoText: { color: '#0F172A', fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  cajaBadge: { backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg },
  cajaText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  itemModelo: { color: colors.text, fontWeight: '600', fontSize: 14 },
  itemTipo: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  itemSubtotal: { color: colors.text, fontWeight: '700' },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  totalLabel: { color: colors.textMuted, fontSize: 14 },
  totalValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  cancelarButton: { marginTop: spacing.lg, alignItems: 'center', padding: spacing.md },
  cancelarText: { color: colors.danger, fontWeight: '700' },
});

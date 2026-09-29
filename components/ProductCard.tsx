import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { Producto } from '@/types/database';

interface Props {
  producto: Producto;
  onPress?: () => void;
}

export function ProductCard({ producto, onPress }: Props) {
  const stockBajo = producto.stock_actual < producto.stock_minimo;
  const tipoTexto = producto.tipo === 'funda' ? 'Funda' : 'Cargador';

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tipoTexto} ${producto.modelo}${producto.variante ? ` ${producto.variante}` : ''}, ${producto.stock_actual} en stock${stockBajo ? ', stock bajo' : ''}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.modelo}>{producto.modelo}</Text>
        <Text style={styles.tipo}>
          {tipoTexto}
          {producto.variante ? ` · ${producto.variante}` : ''}
        </Text>
      </View>
      <View style={styles.stockBox}>
        <Text style={[styles.stock, stockBajo && { color: colors.danger }]}>{producto.stock_actual}</Text>
        <Text style={styles.stockLabel}>en stock</Text>
      </View>
      {stockBajo && <View style={styles.badge}><Text style={styles.badgeText}>BAJO</Text></View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modelo: { color: colors.text, fontSize: 16, fontWeight: '600' },
  tipo: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  stockBox: { alignItems: 'flex-end', marginRight: spacing.sm },
  stock: { color: colors.text, fontSize: 20, fontWeight: '700' },
  stockLabel: { color: colors.textMuted, fontSize: 11 },
  badge: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

interface Barra {
  label: string;
  valor: number;
  sublabel?: string;
  color?: string;
}

interface Props {
  datos: Barra[];
  formatoValor?: (v: number) => string;
}

// Gráfico de barras horizontales simple (sin librería externa), pensado para
// rankings (top productos, top clientes, top empleados) donde el orden y la
// magnitud relativa importan más que la precisión geométrica de un pie chart.
export function BarChart({ datos, formatoValor = (v) => String(v) }: Props) {
  const max = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <View style={{ gap: spacing.sm }}>
      {datos.map((d, i) => (
        <View
          key={i}
          style={styles.row}
          accessible
          accessibilityLabel={`${d.label}${d.sublabel ? ` ${d.sublabel}` : ''}: ${formatoValor(d.valor)}`}
        >
          <View style={styles.labelBox}>
            <Text style={styles.label} numberOfLines={1}>{d.label}</Text>
            {d.sublabel ? <Text style={styles.sublabel} numberOfLines={1}>{d.sublabel}</Text> : null}
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.max((d.valor / max) * 100, 4)}%`, backgroundColor: d.color ?? colors.primary },
              ]}
            />
          </View>
          <Text style={styles.valor}>{formatoValor(d.valor)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  labelBox: { width: 96 },
  label: { color: colors.text, fontSize: 12, fontWeight: '600' },
  sublabel: { color: colors.textMuted, fontSize: 10 },
  barTrack: { flex: 1, height: 16, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.sm },
  valor: { color: colors.text, fontSize: 12, fontWeight: '700', width: 56, textAlign: 'right' },
});

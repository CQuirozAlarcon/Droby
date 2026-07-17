import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

interface Columna {
  key: string;
  label: string;
  flex?: number;
  render?: (row: any) => string;
}

interface Props {
  columnas: Columna[];
  data: any[];
  titulo?: string;
}

export function StatTable({ columnas, data, titulo }: Props) {
  return (
    <View style={styles.container}>
      {titulo && <Text style={styles.titulo}>{titulo}</Text>}
      <View style={styles.headerRow}>
        {columnas.map((c) => (
          <Text key={c.key} style={[styles.headerCell, { flex: c.flex ?? 1 }]}>{c.label}</Text>
        ))}
      </View>
      {data.map((row, i) => (
        <View key={i} style={[styles.row, i % 2 === 1 && { backgroundColor: colors.surfaceAlt }]}>
          {columnas.map((c) => (
            <Text key={c.key} style={[styles.cell, { flex: c.flex ?? 1 }]} numberOfLines={1}>
              {c.render ? c.render(row) : String(row[c.key] ?? '')}
            </Text>
          ))}
        </View>
      ))}
      {data.length === 0 && <Text style={styles.empty}>Sin datos aún</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.md },
  titulo: { color: colors.text, fontWeight: '700', fontSize: 14, padding: spacing.md, paddingBottom: spacing.xs },
  headerRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCell: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  row: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  cell: { color: colors.text, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
});
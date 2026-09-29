import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useState } from 'react';
import { colors, radius, spacing } from '@/lib/theme';
import { useEstadisticas } from '@/hooks/useEstadisticas';
import { EmptyState } from '@/components/EmptyState';
import { BarChart } from '@/components/BarChart';
import { ViewToggle, VistaEstadistica } from '@/components/ViewToggle';

export default function EstadisticasProductosScreen() {
  const { topProductos, loading, error } = useEstadisticas();
  const [vista, setVista] = useState<VistaEstadistica>('grafica');

  if (topProductos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
        <EmptyState
          message={loading ? 'Cargando...' : error ? `No se pudieron cargar las estadísticas: ${error}` : 'Aún no hay ventas para generar estadísticas'}
        />
      </View>
    );
  }

  const top15 = topProductos.slice(0, 15);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <ViewToggle vista={vista} onChange={setVista} />

      {vista === 'grafica' ? (
        <FlatList
          data={[{ key: 'chart' }]}
          keyExtractor={(i) => i.key}
          renderItem={() => (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Unidades vendidas por modelo</Text>
              <BarChart
                datos={top15.map((p) => ({
                  label: p.modelo,
                  sublabel: p.tipo === 'funda' ? 'Funda' : 'Cargador',
                  valor: p.unidadesVendidas,
                  color: p.tipo === 'funda' ? colors.primary : colors.personal,
                }))}
                formatoValor={(v) => `${v} u.`}
              />
            </View>
          )}
        />
      ) : (
        <FlatList
          data={topProductos}
          keyExtractor={(item) => String(item.producto_id)}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modelo}>{item.modelo}</Text>
                <Text style={styles.tipo}>{item.tipo === 'funda' ? 'Funda' : 'Cargador'}{item.variante ? ` · ${item.variante}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.unidades}>{item.unidadesVendidas} u.</Text>
                <Text style={styles.ingresos}>S/ {item.ingresos.toFixed(2)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  chartTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  rank: { color: colors.textMuted, fontWeight: '700', width: 28 },
  modelo: { color: colors.text, fontWeight: '600', fontSize: 14 },
  tipo: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  unidades: { color: colors.text, fontWeight: '800' },
  ingresos: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});

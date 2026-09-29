import { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { useEstadisticas } from '@/hooks/useEstadisticas';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState } from '@/components/EmptyState';
import { SoloAdmin } from '@/components/SoloAdmin';
import { BarChart } from '@/components/BarChart';
import { ViewToggle, VistaEstadistica } from '@/components/ViewToggle';

export default function EstadisticasEmpleadosScreen() {
  const { rol } = useAuth();
  const { rankingEmpleados, loading } = useEstadisticas();
  const [vista, setVista] = useState<VistaEstadistica>('grafica');

  // las horas/pagos salen de la tabla nomina, legible solo por admin (RLS)
  if (rol !== 'admin') return <SoloAdmin />;

  if (rankingEmpleados.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
        <EmptyState message={loading ? 'Cargando...' : 'Aún no hay nóminas generadas para mostrar estadísticas'} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <ViewToggle vista={vista} onChange={setVista} />

      {vista === 'grafica' ? (
        <FlatList
          data={[{ key: 'chart' }]}
          keyExtractor={(i) => i.key}
          renderItem={() => (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Horas trabajadas (acumulado en nóminas)</Text>
              <BarChart
                datos={rankingEmpleados.map((e) => ({ label: e.nombre, valor: e.horasTrabajadas }))}
                formatoValor={(v) => `${v.toFixed(1)} h`}
              />
            </View>
          )}
        />
      ) : (
        <FlatList
          data={rankingEmpleados}
          keyExtractor={(item) => String(item.empleado_id)}
          renderItem={({ item, index }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rank}>#{index + 1}</Text>
                <Text style={styles.nombre}>{item.nombre}</Text>
              </View>
              <View style={styles.detalleRow}>
                <Text style={styles.detalleLabel}>Horas trabajadas</Text>
                <Text style={styles.detalleValor}>{item.horasTrabajadas.toFixed(2)} h</Text>
              </View>
              <View style={styles.detalleRow}>
                <Text style={styles.detalleLabel}>Total pagado</Text>
                <Text style={styles.detalleValor}>S/ {item.totalPagado.toFixed(2)}</Text>
              </View>
              <View style={styles.detalleRow}>
                <Text style={styles.detalleLabel}>Adelantos tomados</Text>
                <Text style={[styles.detalleValor, { color: colors.warning }]}>S/ {item.totalAdelantos.toFixed(2)}</Text>
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
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  rank: { color: colors.textMuted, fontWeight: '700', width: 28 },
  nombre: { color: colors.text, fontWeight: '700', fontSize: 15 },
  detalleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  detalleLabel: { color: colors.textMuted, fontSize: 12 },
  detalleValor: { color: colors.text, fontSize: 12, fontWeight: '600' },
});

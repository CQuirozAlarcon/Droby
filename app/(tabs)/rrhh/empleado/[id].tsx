import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { useEmpleados, useNomina, useAdelantos } from '@/hooks/useRRHH';
import { EmptyState } from '@/components/EmptyState';

export default function DetalleEmpleadoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const empleadoId = Number(id);
  const { empleados } = useEmpleados();
  const { nominas } = useNomina(empleadoId);
  const { adelantos } = useAdelantos(empleadoId);

  const empleado = empleados.find((e) => e.id === empleadoId);

  if (!empleado) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Empleado no encontrado</Text>
      </View>
    );
  }

  const totalAdelantosPendientes = adelantos.filter((a) => !a.descontado).reduce((acc, a) => acc + a.monto, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.nombre}>{empleado.nombre}</Text>
      <Text style={styles.salario}>S/ {empleado.salario_hora.toFixed(2)} / hora</Text>

      {totalAdelantosPendientes > 0 && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>
            Tiene S/ {totalAdelantosPendientes.toFixed(2)} en adelantos pendientes de descontar en la próxima nómina.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Historial de nómina</Text>
      <FlatList
        data={nominas}
        scrollEnabled={false}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.periodo}>{item.semana_inicio} → {item.semana_fin}</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>{item.horas_trabajadas.toFixed(2)} h trabajadas</Text>
              <Text style={[styles.cardValue, item.pagado ? { color: colors.success } : { color: colors.warning }]}>
                {item.pagado ? 'Pagado' : 'Pendiente'}
              </Text>
            </View>
            <Text style={styles.total}>S/ {item.total_pagar.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={<EmptyState message="Sin nóminas generadas" />}
      />

      <Text style={styles.sectionTitle}>Adelantos</Text>
      <FlatList
        data={adelantos}
        scrollEnabled={false}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>{item.motivo}</Text>
              <Text style={[styles.cardValue, item.descontado ? { color: colors.success } : { color: colors.warning }]}>
                {item.descontado ? 'Descontado' : 'Pendiente'}
              </Text>
            </View>
            <Text style={styles.total}>S/ {item.monto.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={<EmptyState message="Sin adelantos registrados" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  notFound: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  nombre: { color: colors.text, fontSize: 24, fontWeight: '700' },
  salario: { color: colors.textMuted, marginBottom: spacing.md },
  alertBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.warning, marginBottom: spacing.md },
  alertText: { color: colors.text, fontSize: 13 },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  periodo: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { color: colors.text, fontSize: 13 },
  cardValue: { fontSize: 12, fontWeight: '700' },
  total: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.xs },
});

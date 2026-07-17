// app/(tabs)/rrhh/nomina.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { useEmpleados, useNomina } from '@/hooks/useRRHH';
import { EmptyState } from '@/components/EmptyState';
import { Select } from '@/components/Select';
import { showAlert } from '@/lib/alert';

// Calcula el lunes de la semana actual en formato YYYY-MM-DD
function lunesDeEstaSemana(): string {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0 = domingo
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return lunes.toISOString().split('T')[0];
}

export default function NominaScreen() {
  const { empleados } = useEmpleados();
  const [empleadoId, setEmpleadoId] = useState<number | null>(empleados[0]?.id ?? null);

  useEffect(() => {
    if (empleadoId === null && empleados.length > 0) setEmpleadoId(empleados[0].id);
  }, [empleados, empleadoId]);
  const { nominas, generarNomina, marcarPagada } = useNomina();
  const [semanaInicio, setSemanaInicio] = useState(lunesDeEstaSemana());
  const [generando, setGenerando] = useState(false);

  function nombreEmpleado(id: number) {
    return empleados.find((e) => e.id === id)?.nombre ?? `Empleado #${id}`;
  }

  async function handleGenerar() {
    if (!empleadoId) return showAlert('Selecciona un empleado');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(semanaInicio)) {
      return showAlert('Fecha inválida', 'Formato requerido: YYYY-MM-DD (debe ser un lunes)');
    }
    setGenerando(true);
    try {
      await generarNomina(empleadoId, semanaInicio);
      showAlert('Nómina generada', 'Horas calculadas y adelantos pendientes descontados automáticamente.');
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGenerando(false);
    }
  }

  async function handlePagar(nominaId: number) {
    try {
      await marcarPagada(nominaId);
    } catch (e: any) {
      showAlert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Empleado</Text>
      <Select
        value={empleadoId}
        onChange={setEmpleadoId}
        searchable
        placeholder="Selecciona un empleado"
        options={empleados.map((e) => ({ label: e.nombre, value: e.id }))}
      />

      <Text style={styles.label}>Semana (lunes de inicio)</Text>
      <TextInput style={styles.input} value={semanaInicio} onChangeText={setSemanaInicio} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />

      <Pressable style={styles.button} onPress={handleGenerar} disabled={generando}>
        <Text style={styles.buttonText}>{generando ? 'Generando...' : 'Generar nómina semanal'}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Nóminas generadas</Text>
      <FlatList
        data={nominas}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.nombre}>{nombreEmpleado(item.empleado_id)}</Text>
            <Text style={styles.periodo}>
              {item.semana_inicio} → {item.semana_fin}
            </Text>
            <View style={styles.detalleRow}>
              <Text style={styles.detalleLabel}>Horas trabajadas</Text>
              <Text style={styles.detalleValor}>{item.horas_trabajadas.toFixed(2)} h</Text>
            </View>
            <View style={styles.detalleRow}>
              <Text style={styles.detalleLabel}>Monto bruto</Text>
              <Text style={styles.detalleValor}>S/ {item.monto_bruto.toFixed(2)}</Text>
            </View>
            <View style={styles.detalleRow}>
              <Text style={styles.detalleLabel}>Adelantos descontados</Text>
              <Text style={[styles.detalleValor, { color: colors.danger }]}>− S/ {item.total_adelantos.toFixed(2)}</Text>
            </View>
            <View style={[styles.detalleRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total a pagar</Text>
              <Text style={styles.totalValor}>S/ {item.total_pagar.toFixed(2)}</Text>
            </View>

            {item.pagado ? (
              <View style={styles.pagadoBadge}>
                <Text style={styles.pagadoText}>✓ Pagado</Text>
              </View>
            ) : (
              <Pressable style={styles.pagarButton} onPress={() => handlePagar(item.id)}>
                <Text style={styles.pagarText}>Marcar como pagado</Text>
              </Pressable>
            )}
          </View>
        )}
        ListEmptyComponent={<EmptyState message="Sin nóminas generadas aún" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  buttonText: { color: colors.bg, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  nombre: { color: colors.text, fontWeight: '700', fontSize: 15 },
  periodo: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  detalleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  detalleLabel: { color: colors.textMuted, fontSize: 13 },
  detalleValor: { color: colors.text, fontSize: 13, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
  totalLabel: { color: colors.text, fontWeight: '700' },
  totalValor: { color: colors.text, fontWeight: '800', fontSize: 16 },
  pagarButton: { backgroundColor: colors.success, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center', marginTop: spacing.md },
  pagarText: { color: '#0F172A', fontWeight: '700' },
  pagadoBadge: { alignItems: 'center', marginTop: spacing.md },
  pagadoText: { color: colors.success, fontWeight: '700' },
});
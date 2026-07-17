// app/(tabs)/rrhh/adelantos.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { useEmpleados, useAdelantos } from '@/hooks/useRRHH';
import { EmptyState } from '@/components/EmptyState';
import { Select } from '@/components/Select';
import { showAlert } from '@/lib/alert';

export default function AdelantosScreen() {
  const { empleados } = useEmpleados();
  const [empleadoId, setEmpleadoId] = useState<number | null>(empleados[0]?.id ?? null);

  useEffect(() => {
    if (empleadoId === null && empleados.length > 0) setEmpleadoId(empleados[0].id);
  }, [empleados, empleadoId]);
  const { adelantos, registrarAdelanto } = useAdelantos();
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function handleRegistrar() {
    const m = parseFloat(monto);
    if (!empleadoId) return showAlert('Selecciona un empleado');
    if (!m || m <= 0) return showAlert('Monto inválido');

    setGuardando(true);
    try {
      await registrarAdelanto(empleadoId, m, motivo || 'Adelanto de sueldo');
      setMonto('');
      setMotivo('');
      showAlert('Adelanto registrado', 'Se descontará automáticamente en la próxima nómina semanal.');
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  function nombreEmpleado(id: number) {
    return empleados.find((e) => e.id === id)?.nombre ?? `Empleado #${id}`;
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

      <Text style={styles.label}>Monto (S/)</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={monto} onChangeText={setMonto} />

      <Text style={styles.label}>Motivo (opcional)</Text>
      <TextInput style={styles.input} value={motivo} onChangeText={setMotivo} />

      <Pressable style={styles.button} onPress={handleRegistrar} disabled={guardando}>
        <Text style={styles.buttonText}>{guardando ? 'Guardando...' : 'Registrar adelanto'}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Historial de adelantos</Text>
      <FlatList
        data={adelantos}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{nombreEmpleado(item.empleado_id)}</Text>
              <Text style={styles.motivo}>{item.motivo}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.monto}>S/ {item.monto.toFixed(2)}</Text>
              <Text style={[styles.estado, item.descontado ? { color: colors.success } : { color: colors.warning }]}>
                {item.descontado
                  ? 'Descontado'
                  : item.saldo_pendiente < item.monto
                  ? `Pendiente: S/ ${item.saldo_pendiente.toFixed(2)}`
                  : 'Pendiente'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState message="Sin adelantos registrados" />}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  nombre: { color: colors.text, fontWeight: '600' },
  motivo: { color: colors.textMuted, fontSize: 12 },
  monto: { color: colors.text, fontWeight: '700' },
  estado: { fontSize: 11, marginTop: 2 },
});
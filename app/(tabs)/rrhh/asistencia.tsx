import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, radius, spacing } from '@/lib/theme';
import { useEmpleados, useAsistencia } from '@/hooks/useRRHH';
import { EmptyState } from '@/components/EmptyState';

export default function AsistenciaScreen() {
  const { empleados } = useEmpleados();
  const [empleadoId, setEmpleadoId] = useState<number | null>(empleados[0]?.id ?? null);
  const { registros, marcarAsistencia } = useAsistencia(empleadoId ?? undefined);
  const [procesando, setProcesando] = useState<'entrada' | 'salida' | null>(null);

  async function handleMarcar(tipo: 'entrada' | 'salida') {
    if (!empleadoId) return Alert.alert('Selecciona un empleado');
    setProcesando(tipo);
    try {
      await marcarAsistencia(empleadoId, tipo, 'manual');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setProcesando(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Empleado</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={empleadoId} onValueChange={setEmpleadoId} dropdownIconColor={colors.text}>
          {empleados.map((e) => (
            <Picker.Item key={e.id} label={e.nombre} value={e.id} color={colors.text} />
          ))}
        </Picker>
      </View>

      <Text style={styles.hint}>Marca manualmente el tipo de registro (no se asume automáticamente).</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.marcarButton, { backgroundColor: colors.success }]}
          onPress={() => handleMarcar('entrada')}
          disabled={procesando !== null || !empleadoId}
        >
          <Text style={styles.marcarText}>{procesando === 'entrada' ? 'Marcando...' : '→ Marcar ENTRADA'}</Text>
        </Pressable>
        <Pressable
          style={[styles.marcarButton, { backgroundColor: colors.danger }]}
          onPress={() => handleMarcar('salida')}
          disabled={procesando !== null || !empleadoId}
        >
          <Text style={styles.marcarText}>{procesando === 'salida' ? 'Marcando...' : '← Marcar SALIDA'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Historial reciente</Text>
      <FlatList
        data={registros}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.rowItem}>
            <Text style={[styles.tipo, item.tipo === 'entrada' ? { color: colors.success } : { color: colors.danger }]}>
              {item.tipo === 'entrada' ? '→ Entrada' : '← Salida'}
            </Text>
            <Text style={styles.hora}>{new Date(item.timestamp).toLocaleString('es-PE')}</Text>
          </View>
        )}
        ListEmptyComponent={<EmptyState message="Sin registros de asistencia" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs },
  pickerWrapper: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  marcarButton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  marcarText: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
  sectionTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  tipo: { fontWeight: '700' },
  hora: { color: colors.textMuted, fontSize: 12 },
});

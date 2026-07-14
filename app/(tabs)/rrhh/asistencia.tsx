import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert, Modal, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, radius, spacing } from '@/lib/theme';
import { useEmpleados, useAsistencia } from '@/hooks/useRRHH';
import { EmptyState } from '@/components/EmptyState';

function fechaHoyStr(): string {
  return new Date().toISOString().split('T')[0];
}
function horaAhoraStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AsistenciaScreen() {
  const { empleados } = useEmpleados();
  const [empleadoId, setEmpleadoId] = useState<number | null>(empleados[0]?.id ?? null);
  const { registros, marcarAsistencia, eliminarAsistencia } = useAsistencia(empleadoId ?? undefined);
  const [procesando, setProcesando] = useState<'entrada' | 'salida' | null>(null);

  const [modalManual, setModalManual] = useState(false);
  const [tipoManual, setTipoManual] = useState<'entrada' | 'salida'>('entrada');
  const [fechaManual, setFechaManual] = useState(fechaHoyStr());
  const [horaManual, setHoraManual] = useState(horaAhoraStr());
  const [guardandoManual, setGuardandoManual] = useState(false);

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

  function abrirModalManual() {
    setFechaManual(fechaHoyStr());
    setHoraManual(horaAhoraStr());
    setTipoManual('entrada');
    setModalManual(true);
  }

  async function handleGuardarManual() {
    if (!empleadoId) return Alert.alert('Selecciona un empleado');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaManual)) return Alert.alert('Formato de fecha inválido', 'Usa YYYY-MM-DD');
    if (!/^\d{2}:\d{2}$/.test(horaManual)) return Alert.alert('Formato de hora inválido', 'Usa HH:MM (24h)');

    const timestampISO = new Date(`${fechaManual}T${horaManual}:00`).toISOString();
    setGuardandoManual(true);
    try {
      await marcarAsistencia(empleadoId, tipoManual, 'manual', timestampISO);
      setModalManual(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setGuardandoManual(false);
    }
  }

  function handleEliminar(registroId: number) {
    Alert.alert('Eliminar registro', '¿Seguro que quieres borrar este marcaje? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await eliminarAsistencia(registroId);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
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

      <Text style={styles.hint}>Marcar ahora mismo:</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.marcarButton, { backgroundColor: colors.success }]}
          onPress={() => handleMarcar('entrada')}
          disabled={procesando !== null || !empleadoId}
        >
          <Text style={styles.marcarText}>{procesando === 'entrada' ? 'Marcando...' : '→ ENTRADA'}</Text>
        </Pressable>
        <Pressable
          style={[styles.marcarButton, { backgroundColor: colors.danger }]}
          onPress={() => handleMarcar('salida')}
          disabled={procesando !== null || !empleadoId}
        >
          <Text style={styles.marcarText}>{procesando === 'salida' ? 'Marcando...' : '← SALIDA'}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.manualButton} onPress={abrirModalManual}>
        <Text style={styles.manualButtonText}>🕒 Marcar con fecha/hora manual (olvidos)</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Historial reciente</Text>
      <FlatList
        data={registros}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tipo, item.tipo === 'entrada' ? { color: colors.success } : { color: colors.danger }]}>
                {item.tipo === 'entrada' ? '→ Entrada' : '← Salida'}
              </Text>
              <Text style={styles.hora}>{new Date(item.timestamp).toLocaleString('es-PE')}</Text>
            </View>
            <Pressable onPress={() => handleEliminar(item.id)} style={styles.deleteButton}>
              <Text style={styles.deleteText}>🗑️</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<EmptyState message="Sin registros de asistencia" />}
      />

      <Modal visible={modalManual} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Marcaje manual</Text>

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.row}>
              {(['entrada', 'salida'] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.chip, tipoManual === t && { backgroundColor: colors.primary }]}
                  onPress={() => setTipoManual(t)}
                >
                  <Text style={[styles.chipText, tipoManual === t && { color: colors.bg, fontWeight: '700' }]}>
                    {t === 'entrada' ? 'Entrada' : 'Salida'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={fechaManual} onChangeText={setFechaManual} placeholder="2026-07-13" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Hora (HH:MM, 24h)</Text>
            <TextInput style={styles.input} value={horaManual} onChangeText={setHoraManual} placeholder="14:30" placeholderTextColor={colors.textMuted} />

            <View style={styles.row}>
              <Pressable style={[styles.modalButton, { backgroundColor: colors.border }]} onPress={() => setModalManual(false)}>
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleGuardarManual} disabled={guardandoManual}>
                <Text style={[styles.modalButtonText, { color: colors.bg, fontWeight: '700' }]}>
                  {guardandoManual ? 'Guardando...' : 'Guardar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs, marginTop: spacing.sm },
  pickerWrapper: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  marcarButton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  marcarText: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
  manualButton: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  manualButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  tipo: { fontWeight: '700' },
  hora: { color: colors.textMuted, fontSize: 12 },
  deleteButton: { padding: spacing.xs },
  deleteText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  chip: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.textMuted },
  modalButton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  modalButtonText: { color: colors.text, fontWeight: '600' },
});

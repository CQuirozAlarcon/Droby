// app/(tabs)/rrhh/empleados.tsx
import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useEmpleados } from '@/hooks/useRRHH';
import { EmptyState } from '@/components/EmptyState';
import { showAlert } from '@/lib/alert';

export default function EmpleadosScreen() {
  const router = useRouter();
  const { empleados, crearEmpleado } = useEmpleados();
  const [modalVisible, setModalVisible] = useState(false);
  const [nombre, setNombre] = useState('');
  const [salarioHora, setSalarioHora] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function handleCrear() {
    const salario = parseFloat(salarioHora);
    if (!nombre.trim()) return showAlert('Falta el nombre');
    if (!salario || salario <= 0) return showAlert('Salario por hora inválido');

    setGuardando(true);
    try {
      await crearEmpleado(nombre.trim(), salario);
      setNombre('');
      setSalarioHora('');
      setModalVisible(false);
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={empleados}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/rrhh/empleado/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <Text style={styles.salario}>S/ {item.salario_hora.toFixed(2)} / hora</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState message="Sin empleados registrados aún" />}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
      />

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo empleado</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Salario por hora (S/)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={salarioHora} onChangeText={setSalarioHora} />

            <View style={styles.row}>
              <Pressable style={[styles.modalButton, { backgroundColor: colors.border }]} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleCrear} disabled={guardando}>
                <Text style={[styles.modalButtonText, { color: colors.bg, fontWeight: '700' }]}>
                  {guardando ? 'Guardando...' : 'Crear'}
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
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  nombre: { color: colors.text, fontWeight: '700', fontSize: 15 },
  salario: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chevron: { color: colors.textMuted, fontSize: 22 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabText: { color: colors.bg, fontSize: 28, fontWeight: '700', lineHeight: 30 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalButton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  modalButtonText: { color: colors.text, fontWeight: '600' },
});
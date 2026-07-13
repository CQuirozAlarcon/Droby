import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Alert, Modal } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { useFinanzas } from '@/hooks/useFinanzas';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState } from '@/components/EmptyState';
import { CajaDestino } from '@/types/database';

type ModalTipo = 'gasto' | 'ingreso' | 'transferencia' | null;

export default function FinanzasScreen() {
  const { rol } = useAuth();
  const esAdmin = rol === 'admin';
  const { cajas, movimientos, saldoDe, registrarMovimientoManual, transferirEntreCajas } = useFinanzas();

  const [modalVisible, setModalVisible] = useState<ModalTipo>(null);
  const [caja, setCaja] = useState<CajaDestino>('empresa');
  const [destino, setDestino] = useState<CajaDestino>('personal');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [procesando, setProcesando] = useState(false);

  const movimientosVisibles = esAdmin
    ? movimientos
    : movimientos.filter((m) => cajas.find((c) => c.id === m.caja_id)?.tipo === 'empresa');

  async function handleGastoOIngreso() {
    const m = parseFloat(monto);
    if (!m || m <= 0) return Alert.alert('Monto inválido');
    setProcesando(true);
    try {
      const tipo = modalVisible === 'ingreso' ? 'ingreso' : 'egreso';
      const categoria = modalVisible === 'ingreso' ? 'ingreso_extra' : 'gasto_manual';
      await registrarMovimientoManual(caja, tipo, m, categoria, descripcion || (tipo === 'ingreso' ? 'Ingreso extra' : 'Gasto'));
      cerrarModal();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function handleTransferencia() {
    const m = parseFloat(monto);
    if (!m || m <= 0) return Alert.alert('Monto inválido');
    setProcesando(true);
    try {
      await transferirEntreCajas(caja, destino, m, descripcion || 'Transferencia interna');
      cerrarModal();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setProcesando(false);
    }
  }

  function cerrarModal() {
    setModalVisible(null);
    setMonto('');
    setDescripcion('');
  }

  function tituloModal() {
    if (modalVisible === 'gasto') return 'Registrar gasto';
    if (modalVisible === 'ingreso') return 'Registrar ingreso extra';
    return 'Transferencia interna';
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <View style={styles.cajasRow}>
        <View style={[styles.cajaCard, { borderColor: colors.empresa }]}>
          <Text style={styles.cajaLabel}>Caja Empresa</Text>
          <Text style={styles.cajaSaldo}>S/ {saldoDe('empresa').toFixed(2)}</Text>
        </View>
        {esAdmin && (
          <View style={[styles.cajaCard, { borderColor: colors.personal }]}>
            <Text style={styles.cajaLabel}>Caja Personal</Text>
            <Text style={styles.cajaSaldo}>S/ {saldoDe('personal').toFixed(2)}</Text>
          </View>
        )}
      </View>

      {esAdmin && (
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={() => setModalVisible('gasto')}>
            <Text style={styles.actionText}>− Gasto</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setModalVisible('ingreso')}>
            <Text style={styles.actionText}>+ Ingreso extra</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setModalVisible('transferencia')}>
            <Text style={styles.actionText}>⇄ Transferir</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.hint}>
        Gasto e Ingreso extra son movimientos fuera de las ventas (las ventas siempre entran solas a Caja Empresa). Úsalos para gastos/ingresos de la empresa o de la cuenta personal del dueño.
      </Text>

      <Text style={styles.sectionTitle}>Movimientos recientes</Text>
      <FlatList
        data={movimientosVisibles}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const cajaTipo = cajas.find((c) => c.id === item.caja_id)?.tipo;
          return (
            <View style={styles.movRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.movDesc}>{item.descripcion || item.categoria}</Text>
                <Text style={styles.movMeta}>
                  {cajaTipo === 'personal' ? '👤 Personal' : '🏢 Empresa'} · {new Date(item.created_at).toLocaleDateString('es-PE')}
                </Text>
              </View>
              <Text style={[styles.movMonto, item.tipo === 'ingreso' ? { color: colors.success } : { color: colors.danger }]}>
                {item.tipo === 'ingreso' ? '+' : '−'} S/ {item.monto.toFixed(2)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyState message="Sin movimientos" />}
      />

      <Modal visible={modalVisible !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tituloModal()}</Text>

            <Text style={styles.label}>{modalVisible === 'transferencia' ? 'Desde' : 'Caja'}</Text>
            <View style={styles.row}>
              {(['empresa', 'personal'] as const).map((c) => (
                <Pressable
                  key={c}
                  style={[styles.chip, caja === c && { backgroundColor: colors.primary }]}
                  onPress={() => setCaja(c)}
                >
                  <Text style={[styles.chipText, caja === c && { color: colors.bg, fontWeight: '700' }]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            {modalVisible === 'transferencia' && (
              <>
                <Text style={styles.label}>Hacia</Text>
                <View style={styles.row}>
                  {(['empresa', 'personal'] as const).map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.chip, destino === c && { backgroundColor: colors.primary }]}
                      onPress={() => setDestino(c)}
                    >
                      <Text style={[styles.chipText, destino === c && { color: colors.bg, fontWeight: '700' }]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Monto (S/)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={monto} onChangeText={setMonto} />

            <Text style={styles.label}>Descripción</Text>
            <TextInput style={styles.input} value={descripcion} onChangeText={setDescripcion} />

            <View style={styles.row}>
              <Pressable style={[styles.modalButton, { backgroundColor: colors.border }]} onPress={cerrarModal}>
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={modalVisible === 'transferencia' ? handleTransferencia : handleGastoOIngreso}
                disabled={procesando}
              >
                <Text style={[styles.modalButtonText, { color: colors.bg, fontWeight: '700' }]}>
                  {procesando ? 'Procesando...' : 'Confirmar'}
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
  cajasRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  cajaCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1 },
  cajaLabel: { color: colors.textMuted, fontSize: 12 },
  cajaSaldo: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: spacing.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  actionButton: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  actionText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  hint: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  movRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  movDesc: { color: colors.text, fontSize: 13 },
  movMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  movMonto: { fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.textMuted, textTransform: 'capitalize' },
  modalButton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  modalButtonText: { color: colors.text, fontWeight: '600' },
});

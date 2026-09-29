import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useConsignaciones } from '@/hooks/useConsignaciones';
import { Consignacion } from '@/types/database';
import { showAlert } from '@/lib/alert';
import { EmptyState } from '@/components/EmptyState';

export default function DetalleConsignacionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { registrarPago, obtenerConsignacionPorId } = useConsignaciones();
  const [consignacion, setConsignacion] = useState<Consignacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  // fetch directo por id: antes dependía de la lista limitada del hook y una
  // consignación antigua (fuera del tope) mostraba "no encontrada"
  const cargar = useCallback(async () => {
    try {
      const data = await obtenerConsignacionPorId(Number(id));
      setConsignacion(data);
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setCargando(false);
    }
  }, [id, obtenerConsignacionPorId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando && !consignacion) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!consignacion) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Consignación no encontrada</Text>
      </View>
    );
  }

  const saldo = Number(consignacion.saldo_pendiente);

  async function handlePagar(montoExacto?: number) {
    if (!consignacion) return;
    const m = montoExacto ?? parseFloat(monto);
    if (!m || m <= 0) return showAlert('Monto inválido', 'Ingresa un monto mayor a 0');
    if (m > saldo + 0.01) return showAlert('Monto excede el saldo', `El saldo pendiente es S/ ${saldo.toFixed(2)}`);

    setGuardando(true);
    try {
      await registrarPago(consignacion.id, m, nota || undefined);
      setMonto('');
      setNota('');
      await cargar();
      showAlert('Pago registrado', 'El saldo por cobrar se actualizó y el ingreso ya aparece en Finanzas.');
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      data={consignacion.consignacion_pagos ?? []}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <>
          <Text style={styles.cliente}>{consignacion.clientes?.nombre ?? `Cliente #${consignacion.cliente_id}`}</Text>
          <Text style={styles.fecha}>Entregada: {new Date(consignacion.fecha_entrega).toLocaleDateString('es-PE')}</Text>
          {consignacion.fecha_limite && <Text style={styles.fecha}>Límite de cobro: {consignacion.fecha_limite}</Text>}

          <View style={styles.resumenRow}>
            <View style={styles.resumenCard}>
              <Text style={styles.resumenLabel}>Total consignado</Text>
              <Text style={styles.resumenValor}>S/ {Number(consignacion.monto_total).toFixed(2)}</Text>
            </View>
            <View style={styles.resumenCard}>
              <Text style={styles.resumenLabel}>Cobrado</Text>
              <Text style={[styles.resumenValor, { color: colors.success }]}>S/ {Number(consignacion.monto_cobrado).toFixed(2)}</Text>
            </View>
            <View style={[styles.resumenCard, { borderColor: colors.porCobrar, borderWidth: 1 }]}>
              <Text style={styles.resumenLabel}>Por cobrar</Text>
              <Text style={[styles.resumenValor, { color: colors.porCobrar }]}>S/ {saldo.toFixed(2)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Productos entregados</Text>
          {(consignacion.consignacion_items ?? []).map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemModelo}>{item.productos?.modelo ?? 'Producto eliminado'}</Text>
                <Text style={styles.itemTipo}>
                  {item.productos?.tipo === 'funda' ? 'Funda' : 'Cargador'}
                  {item.productos?.variante ? ` · ${item.productos.variante}` : ''} · {item.cantidad} unid.
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>S/ {Number(item.subtotal).toFixed(2)}</Text>
            </View>
          ))}

          {saldo > 0 && (
            <View style={styles.pagoBox}>
              <Text style={styles.sectionTitle}>Registrar pago</Text>
              <TextInput
                style={styles.input}
                placeholder={`Monto (máx. S/ ${saldo.toFixed(2)})`}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={monto}
                onChangeText={setMonto}
              />
              <TextInput style={styles.input} placeholder="Nota (opcional)" placeholderTextColor={colors.textMuted} value={nota} onChangeText={setNota} />
              <View style={styles.row}>
                <Pressable
                  style={[styles.pagoButton, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => handlePagar()}
                  disabled={guardando}
                  accessibilityRole="button"
                  accessibilityLabel="Registrar pago parcial"
                  accessibilityState={{ busy: guardando }}
                >
                  <Text style={styles.pagoButtonText}>{guardando ? 'Procesando...' : 'Registrar pago parcial'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.pagoButton, { backgroundColor: colors.success }]}
                  onPress={() => handlePagar(saldo)}
                  disabled={guardando}
                  accessibilityRole="button"
                  accessibilityLabel={`Pagar todo el saldo, ${saldo.toFixed(2)} soles`}
                  accessibilityState={{ busy: guardando }}
                >
                  <Text style={[styles.pagoButtonText, { color: '#0F172A' }]}>Pagar todo (S/ {saldo.toFixed(2)})</Text>
                </Pressable>
              </View>
            </View>
          )}

          {saldo <= 0 && (
            <View style={styles.liquidadaBox}>
              <Text style={styles.liquidadaText}>✓ Consignación liquidada por completo</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Historial de pagos</Text>
          {(consignacion.consignacion_pagos ?? []).length === 0 && <EmptyState message="Aún no se han registrado pagos" />}
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.pagoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pagoFecha}>{item.fecha}</Text>
            {item.nota ? <Text style={styles.pagoNota}>{item.nota}</Text> : null}
          </View>
          <Text style={styles.pagoMonto}>+ S/ {Number(item.monto).toFixed(2)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  notFound: { color: colors.textMuted },
  cliente: { color: colors.text, fontSize: 22, fontWeight: '700' },
  fecha: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  resumenRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.lg },
  resumenCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
  resumenLabel: { color: colors.textMuted, fontSize: 10 },
  resumenValor: { color: colors.text, fontWeight: '800', fontSize: 15, marginTop: 2 },
  sectionTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.xs },
  itemModelo: { color: colors.text, fontWeight: '600', fontSize: 14 },
  itemTipo: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  itemSubtotal: { color: colors.text, fontWeight: '700' },
  pagoBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  pagoButton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  pagoButtonText: { color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  liquidadaBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg, alignItems: 'center' },
  liquidadaText: { color: colors.success, fontWeight: '700' },
  pagoRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs },
  pagoFecha: { color: colors.text, fontSize: 13 },
  pagoNota: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  pagoMonto: { color: colors.success, fontWeight: '700' },
});

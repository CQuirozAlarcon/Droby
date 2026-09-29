import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useFinanzas } from '@/hooks/useFinanzas';
import { useConsignaciones } from '@/hooks/useConsignaciones';
import { useFocusRefetch } from '@/hooks/useFocusRefetch';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState } from '@/components/EmptyState';
import { CajaDestino } from '@/types/database';
import { showAlert } from '@/lib/alert';

type ModalTipo = 'gasto' | 'ingreso' | 'transferencia' | null;
// "Compra de inventario" es INVERSIÓN (cambia efectivo por mercadería), no un
// gasto operativo. Por eso tiene categoría propia: no se descuenta de la
// ganancia neta, pero sí sale del flujo de caja.
type CategoriaGasto = 'gasto_manual' | 'compra_inventario';

export default function FinanzasScreen() {
  const router = useRouter();
  const { rol } = useAuth();
  const esAdmin = rol === 'admin';
  const { cajas, movimientos, resumen, saldoDe, registrarMovimientoManual, transferirEntreCajas, refetch } = useFinanzas();
  const { pendientes, totalCuentasPorCobrar, refetch: refetchConsignaciones } = useConsignaciones();
  // si se registró un pago de consignación (u otro movimiento) en otra
  // pantalla, al volver aquí los saldos se refrescan solos
  useFocusRefetch(refetch);
  useFocusRefetch(refetchConsignaciones);

  const [modalVisible, setModalVisible] = useState<ModalTipo>(null);
  const [caja, setCaja] = useState<CajaDestino>('empresa');
  const [destino, setDestino] = useState<CajaDestino>('personal');
  const [categoriaGasto, setCategoriaGasto] = useState<CategoriaGasto>('gasto_manual');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [procesando, setProcesando] = useState(false);

  const saldoEmpresa = saldoDe('empresa');
  const saldoPersonal = saldoDe('personal');
  const valorInventario = resumen?.valor_inventario ?? 0;
  // Patrimonio real: lo que hay en caja MÁS lo que hay guardado en mercadería.
  // Una caja negativa tras estockearse no significa pérdida: el dinero está
  // en el almacén.
  const patrimonioNeto = saldoEmpresa + valorInventario;

  const movimientosVisibles = esAdmin
    ? movimientos
    : movimientos.filter((m) => cajas.find((c) => c.id === m.caja_id)?.tipo === 'empresa');

  async function handleGastoOIngreso() {
    const m = parseFloat(monto);
    if (!m || m <= 0) return showAlert('Monto inválido');
    setProcesando(true);
    try {
      const tipo = modalVisible === 'ingreso' ? 'ingreso' : 'egreso';
      const categoria = modalVisible === 'ingreso' ? 'ingreso_extra' : categoriaGasto;
      const descDefault =
        tipo === 'ingreso'
          ? 'Ingreso extra'
          : categoriaGasto === 'compra_inventario'
            ? 'Compra de inventario'
            : 'Gasto operativo';
      await registrarMovimientoManual(caja, tipo, m, categoria, descripcion || descDefault);
      cerrarModal();
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function handleTransferencia() {
    const m = parseFloat(monto);
    if (!m || m <= 0) return showAlert('Monto inválido');
    setProcesando(true);
    try {
      await transferirEntreCajas(caja, destino, m, descripcion || 'Transferencia interna');
      cerrarModal();
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setProcesando(false);
    }
  }

  function cerrarModal() {
    setModalVisible(null);
    setMonto('');
    setDescripcion('');
    setCategoriaGasto('gasto_manual');
  }

  function tituloModal() {
    if (modalVisible === 'gasto') return 'Registrar gasto';
    if (modalVisible === 'ingreso') return 'Registrar ingreso extra';
    return 'Transferencia interna';
  }

  // ---- Cálculos del Estado de Resultados (rentabilidad) ----
  const ventasBrutas = resumen?.ventas_brutas ?? 0;
  const costoProductos = resumen?.costo_productos_vendidos ?? 0;
  const gananciaBruta = ventasBrutas - costoProductos;
  // Gastos operativos = lo que se va y NO vuelve (luz, sueldos, empaques…).
  // La compra de inventario NO está aquí: eso es inversión.
  const gastosOperativos =
    (resumen?.egresos_gasto_manual ?? 0) +
    (resumen?.egresos_adelanto ?? 0) +
    (resumen?.egresos_nomina ?? 0);
  const gananciaNeta = gananciaBruta - gastosOperativos;
  const inversionMercaderia = resumen?.egresos_compra_inventario ?? 0;

  const colorSaldoEmpresa = saldoEmpresa < 0 ? colors.warning : colors.empresa;
  const colorPatrimonio = patrimonioNeto >= 0 ? colors.success : colors.danger;

  const header = (
    <>
      {/* ============ LIQUIDEZ: cuánto efectivo hay ============ */}
      <View style={styles.cajasRow}>
        <View style={[styles.cajaCard, { borderColor: colorSaldoEmpresa }]}>
          <Text style={styles.cajaLabel}>Caja Empresa</Text>
          <Text
            style={[styles.cajaSaldo, saldoEmpresa < 0 && { color: colors.warning }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            S/ {saldoEmpresa.toFixed(2)}
          </Text>
        </View>
        {esAdmin && (
          <View style={[styles.cajaCard, { borderColor: colors.personal }]}>
            <Text style={styles.cajaLabel}>Caja Personal</Text>
            <Text style={styles.cajaSaldo} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
              S/ {saldoPersonal.toFixed(2)}
            </Text>
          </View>
        )}
      </View>
      {saldoEmpresa < 0 && (
        <Text style={styles.hintLiquidez}>
          ⚠ Caja en negativo: es una alerta de liquidez (falta efectivo), no necesariamente una pérdida. Mira abajo el Patrimonio Neto.
        </Text>
      )}

      {/* Valor guardado en el almacén */}
      {esAdmin && resumen && (
        <View style={[styles.infoCard, { borderColor: colors.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cajaLabel}>Valor en Almacén</Text>
            <Text style={styles.cajaHint}>Stock actual valorizado a costo</Text>
          </View>
          <Text
            style={[styles.cajaSaldo, { color: colors.primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            S/ {valorInventario.toFixed(2)}
          </Text>
        </View>
      )}

      {/* Cuentas por cobrar — sin flex:1 heredado: antes la tarjeta se
          estiraba verticalmente y el contenido quedaba fuera de vista */}
      <Pressable
        style={styles.porCobrarCard}
        onPress={() => router.push('/ventas/consignaciones')}
        accessibilityRole="button"
        accessibilityLabel={`Cuentas por cobrar: ${totalCuentasPorCobrar.toFixed(2)} soles en ${pendientes.length} consignaciones. Ir a Consignaciones`}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.cajaLabel}>Cuentas por cobrar</Text>
          <Text style={styles.cajaHint} numberOfLines={2}>Consignaciones pendientes o parciales</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={[styles.cajaSaldo, { color: colors.porCobrar }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            S/ {totalCuentasPorCobrar.toFixed(2)}
          </Text>
          <Text style={styles.cajaHint} numberOfLines={1}>{pendientes.length} consignación(es)</Text>
        </View>
      </Pressable>

      {/* ============ PATRIMONIO: caja + mercadería ============ */}
      {esAdmin && resumen && (
        <View style={[styles.infoCard, { borderColor: colorPatrimonio }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cajaLabel}>Patrimonio Neto</Text>
            <Text style={styles.cajaHint}>Caja Empresa + Valor en Almacén</Text>
          </View>
          <Text
            style={[styles.cajaSaldo, { color: colorPatrimonio }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            S/ {patrimonioNeto.toFixed(2)}
          </Text>
        </View>
      )}

      {/* ============ RENTABILIDAD: Estado de Resultados ============ */}
      {esAdmin && resumen && (
        <View style={styles.resumenCard}>
          <View style={styles.resumenHeader}>
            <Text style={styles.resumenTitulo}>Estado de Resultados</Text>
            <Text style={styles.resumenSub}>Rentabilidad histórica del negocio</Text>
          </View>

          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Ventas totales</Text>
            <Text style={styles.resumenValor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              S/ {ventasBrutas.toFixed(2)}
            </Text>
          </View>
          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Costo de productos vendidos</Text>
            <Text style={[styles.resumenValor, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              − S/ {costoProductos.toFixed(2)}
            </Text>
          </View>
          <View style={styles.resumenSeparador} />
          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabelNegrita}>Ganancia bruta</Text>
            <Text
              style={[styles.resumenValorNegrita, { color: gananciaBruta >= 0 ? colors.success : colors.danger }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              S/ {gananciaBruta.toFixed(2)}
            </Text>
          </View>

          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Gastos operativos (manuales)</Text>
            <Text style={[styles.resumenValor, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              − S/ {(resumen?.egresos_gasto_manual ?? 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Adelantos a empleados</Text>
            <Text style={[styles.resumenValor, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              − S/ {(resumen?.egresos_adelanto ?? 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Nómina pagada</Text>
            <Text style={[styles.resumenValor, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              − S/ {(resumen?.egresos_nomina ?? 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.resumenSeparador} />
          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabelNegrita}>Ganancia neta</Text>
            <Text
              style={[styles.resumenValorDestacado, { color: gananciaNeta >= 0 ? colors.success : colors.danger }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              S/ {gananciaNeta.toFixed(2)}
            </Text>
          </View>

          {inversionMercaderia > 0 && (
            <>
              <View style={styles.resumenSeparador} />
              <View style={styles.resumenFila}>
                <Text style={styles.resumenLabel}>Inversión en mercadería</Text>
                <Text style={[styles.resumenValor, { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  S/ {inversionMercaderia.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.resumenHint}>
                La compra de inventario es inversión (efectivo → mercadería): reduce la caja pero no la ganancia. Ese valor lo recuperas al vender.
              </Text>
            </>
          )}
          {inversionMercaderia === 0 && (
            <Text style={styles.resumenHint}>
              Nota: si registraste compras de mercadería como "Gasto operativo", la ganancia se verá castigada. Usa la categoría "Compra de inventario" al registrar el gasto.
            </Text>
          )}
        </View>
      )}

      {esAdmin && (
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={() => setModalVisible('gasto')} accessibilityRole="button" accessibilityLabel="Registrar gasto o compra de inventario">
            <Text style={styles.actionText}>− Gasto</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setModalVisible('ingreso')} accessibilityRole="button" accessibilityLabel="Registrar ingreso extra">
            <Text style={styles.actionText}>+ Ingreso extra</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setModalVisible('transferencia')} accessibilityRole="button" accessibilityLabel="Transferir entre cajas">
            <Text style={styles.actionText}>⇄ Transferir</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.hint}>
        Las ventas entran solas a Caja Empresa. Las consignaciones no generan ingreso hasta que se registre su pago (mientras tanto están en "Cuentas por cobrar").
      </Text>

      <Text style={styles.sectionTitle}>Movimientos recientes</Text>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Todo el contenido va dentro del FlatList (header + items): así la
          lista de movimientos nunca queda aplastada por las tarjetas de
          arriba y toda la pantalla scrollea como una sola pieza. */}
      <FlatList
        data={movimientosVisibles}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const cajaTipo = cajas.find((c) => c.id === item.caja_id)?.tipo;
          const esCobroConsignacion = item.categoria === 'consignacion_pago';
          const esCompraInventario = item.categoria === 'compra_inventario';
          const esEntrada =
            item.tipo === 'ingreso' ||
            (item.tipo === 'transferencia_interna' && (item.categoria ?? '').startsWith('transferencia_desde_'));
          return (
            <View style={styles.movRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.movDesc}>{item.descripcion || item.categoria}</Text>
                <Text style={styles.movMeta}>
                  {cajaTipo === 'personal' ? '👤 Personal' : '🏢 Empresa'} · {new Date(item.created_at).toLocaleDateString('es-PE')}
                  {esCobroConsignacion ? ' · 📑 pago de consignación' : ''}
                  {esCompraInventario ? ' · 📦 inversión en mercadería' : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.movMonto,
                  esEntrada
                    ? { color: colors.success }
                    : esCompraInventario
                      ? { color: colors.primary }
                      : { color: colors.danger },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {esEntrada ? '+' : '−'} S/ {item.monto.toFixed(2)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyState message="Sin movimientos" />}
      />

      <Modal visible={modalVisible !== null} transparent animationType="slide" onRequestClose={cerrarModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tituloModal()}</Text>

            <Text style={styles.label}>{modalVisible === 'transferencia' ? 'Desde' : 'Caja'}</Text>
            <View style={styles.row}>
              {(['empresa', 'personal'] as const).map((c) => (
                <Pressable key={c} style={[styles.chip, caja === c && { backgroundColor: colors.primary }]} onPress={() => setCaja(c)}>
                  <Text style={[styles.chipText, caja === c && { color: colors.bg, fontWeight: '700' }]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            {modalVisible === 'gasto' && (
              <>
                <Text style={styles.label}>Tipo de gasto</Text>
                <View style={styles.row}>
                  {(
                    [
                      { valor: 'gasto_manual' as CategoriaGasto, label: 'Operativo' },
                      { valor: 'compra_inventario' as CategoriaGasto, label: 'Compra inventario' },
                    ] as const
                  ).map((op) => (
                    <Pressable
                      key={op.valor}
                      style={[styles.chip, categoriaGasto === op.valor && { backgroundColor: colors.primary }]}
                      onPress={() => setCategoriaGasto(op.valor)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: categoriaGasto === op.valor }}
                      accessibilityLabel={`Tipo de gasto: ${op.label}`}
                    >
                      <Text style={[styles.chipText, categoriaGasto === op.valor && { color: colors.bg, fontWeight: '700' }]}>
                        {op.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.hintModal}>
                  {categoriaGasto === 'compra_inventario'
                    ? '📦 Inversión: el dinero sale de caja pero queda guardado en mercadería. No castiga la ganancia.'
                    : '🧾 Gasto operativo: luz, internet, sueldos, empaques… se descuenta de la ganancia.'}
                </Text>
              </>
            )}

            {modalVisible === 'transferencia' && (
              <>
                <Text style={styles.label}>Hacia</Text>
                <View style={styles.row}>
                  {(['empresa', 'personal'] as const).map((c) => (
                    <Pressable
                      key={c}
                      disabled={c === caja}
                      accessibilityState={{ disabled: c === caja }}
                      style={[styles.chip, destino === c && { backgroundColor: colors.primary }, c === caja && { opacity: 0.3 }]}
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
  cajasRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  cajaCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1 },
  cajaLabel: { color: colors.textMuted, fontSize: 12 },
  cajaSaldo: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: spacing.xs },
  cajaHint: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  hintLiquidez: { color: colors.warning, fontSize: 11, marginBottom: spacing.sm, lineHeight: 15 },
  // Cards de info (Almacén / Patrimonio / Por cobrar): altura NATURAL, sin
  // flex:1 — ese era el bug que estiraba la tarjeta naranja y ocultaba su
  // contenido (solo se veía el borde).
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  porCobrarCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.porCobrar,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  actionButton: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  actionText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  hint: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.md, lineHeight: 15 },
  hintModal: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.xs, lineHeight: 15 },
  resumenCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  resumenHeader: { marginBottom: spacing.sm },
  resumenTitulo: { color: colors.text, fontWeight: '700', fontSize: 14 },
  resumenSub: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  resumenFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.sm },
  resumenLabel: { color: colors.textMuted, fontSize: 12, flex: 1 },
  resumenLabelNegrita: { color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 },
  resumenValor: { color: colors.text, fontSize: 13, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  resumenValorNegrita: { color: colors.text, fontSize: 15, fontWeight: '800', maxWidth: '55%', textAlign: 'right' },
  resumenValorDestacado: { fontSize: 22, fontWeight: '800', maxWidth: '65%', textAlign: 'right' },
  resumenSeparador: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  resumenHint: { color: colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: spacing.xs },
  sectionTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  movRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  movDesc: { color: colors.text, fontSize: 13 },
  movMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  movMonto: { fontWeight: '700', maxWidth: '40%', textAlign: 'right' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border, minHeight: 44, justifyContent: 'center' },
  chipText: { color: colors.textMuted, textTransform: 'capitalize', fontSize: 13 },
  modalButton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md, minHeight: 48, justifyContent: 'center' },
  modalButtonText: { color: colors.text, fontWeight: '600' },
});

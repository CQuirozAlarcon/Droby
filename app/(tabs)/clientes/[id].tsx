import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useClienteDetalle, useClientes } from '@/hooks/useClientes';
import { useFocusRefetch } from '@/hooks/useFocusRefetch';
import { Select } from '@/components/Select';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { TipoCliente } from '@/types/database';
import { showAlert } from '@/lib/alert';

const OPCIONES_TIPO: { label: string; value: TipoCliente }[] = [
  { label: 'Mayorista', value: 'mayorista' },
  { label: 'Minorista', value: 'minorista' },
  { label: 'Vendedor', value: 'vendedor' },
];

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ClienteDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const clienteId = id ? parseInt(id, 10) : null;

  const { cliente, loading, refetch } = useClienteDetalle(clienteId);
  const { actualizarCliente } = useClientes();
  // al volver de registrar una venta, el historial se refresca solo
  useFocusRefetch(refetch);

  const [editVisible, setEditVisible] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editTipo, setEditTipo] = useState<TipoCliente>('mayorista');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDocumento, setEditDocumento] = useState('');
  const [guardando, setGuardando] = useState(false);

  // cuando carga el cliente (o cambia desde la BD), pre-rellena el form
  useEffect(() => {
    if (cliente) {
      setEditNombre(cliente.nombre);
      setEditTipo(cliente.tipo_cliente);
      setEditTelefono(cliente.telefono ?? '');
      setEditDocumento(cliente.documento ?? '');
    }
  }, [cliente]);

  const ventasCompletadas = cliente?.ventas.filter((v) => v.estado === 'completada') ?? [];
  const totalVentas = ventasCompletadas.reduce((sum, v) => sum + Number(v.total), 0);
  const numeroVentas = ventasCompletadas.length;
  const ultimaVenta =
    ventasCompletadas
      .map((v) => v.created_at)
      .sort()
      .pop() ?? null;

  const totalPorCobrar =
    cliente?.consignaciones
      .filter((c) => c.estado !== 'liquidada')
      .reduce((sum, c) => sum + Number(c.saldo_pendiente), 0) ?? 0;
  const numeroConsignacionesPendientes =
    cliente?.consignaciones.filter((c) => c.estado !== 'liquidada').length ?? 0;

  async function handleGuardarEdicion() {
    if (!cliente) return;
    if (!editNombre.trim()) {
      showAlert('Falta el nombre', 'Ingresa el nombre del cliente');
      return;
    }
    setGuardando(true);
    try {
      await actualizarCliente(cliente.id, {
        nombre: editNombre.trim(),
        tipo_cliente: editTipo,
        telefono: editTelefono.trim() || null,
        documento: editDocumento.trim() || null,
      });
      setEditVisible(false);
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!loading && !cliente) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md, justifyContent: 'center' }}>
        <EmptyState message="Cliente no encontrado" />
      </View>
    );
  }

  if (!cliente) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md, justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Cargando…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nombre} numberOfLines={2}>{cliente.nombre}</Text>
          <Text style={styles.tipo}>{cliente.tipo_cliente}</Text>
        </View>
        <Pressable
          style={styles.editButton}
          onPress={() => setEditVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Editar datos del cliente"
        >
          <Text style={styles.editButtonText}>Editar</Text>
        </Pressable>
      </View>

      <View style={styles.infoCard}>
        {cliente.telefono ? (
          <View style={styles.infoFila}>
            <Text style={styles.infoLabel}>Teléfono</Text>
            <Text style={styles.infoValor}>{cliente.telefono}</Text>
          </View>
        ) : null}
        {cliente.documento ? (
          <View style={styles.infoFila}>
            <Text style={styles.infoLabel}>RUC / DNI</Text>
            <Text style={styles.infoValor}>{cliente.documento}</Text>
          </View>
        ) : null}
        <View style={styles.infoFila}>
          <Text style={styles.infoLabel}>Cliente desde</Text>
          <Text style={styles.infoValor}>{formatearFecha(cliente.created_at)}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={{ flex: 1 }}>
          <StatCard
            label="Total comprado"
            valor={`S/ ${totalVentas.toFixed(0)}`}
            color={colors.primary}
            accessibilityLabel={`Total comprado: ${totalVentas.toFixed(2)} soles en ${numeroVentas} ventas`}
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatCard
            label="Ventas"
            valor={`${numeroVentas}`}
            color={colors.text}
            accessibilityLabel={`${numeroVentas} ventas completadas`}
          />
        </View>
      </View>

      {totalPorCobrar > 0 && (
        <StatCard
          label="Por cobrar"
          valor={`S/ ${totalPorCobrar.toFixed(2)}`}
          color={colors.porCobrar}
          subInfo={`${numeroConsignacionesPendientes} consignación(es) pendiente(s) o parcial(es)`}
          accessibilityLabel={`Por cobrar: ${totalPorCobrar.toFixed(2)} soles en ${numeroConsignacionesPendientes} consignaciones pendientes`}
        />
      )}

      {ultimaVenta ? (
        <Text style={styles.ultimaVenta}>Última venta: {formatearFechaHora(ultimaVenta)}</Text>
      ) : null}

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() =>
            router.push({
              pathname: '/ventas/nueva',
              params: { clienteId: String(cliente.id), clienteNombre: cliente.nombre },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Registrar nueva venta o consignación con este cliente"
        >
          <Text style={[styles.actionText, { color: colors.bg }]}>+ Nueva venta / consignación</Text>
        </Pressable>
      </View>

      <SectionHeader titulo={`Ventas (${cliente.ventas.length})`} />
      {cliente.ventas.length === 0 ? (
        <EmptyState message="Aún no hay ventas con este cliente" />
      ) : (
        cliente.ventas.map((v) => (
          <Pressable
            key={`v-${v.id}`}
            style={styles.movCard}
            onPress={() => router.push(`/ventas/${v.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Venta ${v.id}: ${Number(v.total).toFixed(2)} soles, estado ${v.estado}, ${formatearFechaHora(v.created_at)}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.movTitulo}>Venta #{v.id}</Text>
              <Text style={styles.movMeta}>{formatearFechaHora(v.created_at)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.movMonto} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                S/ {Number(v.total).toFixed(2)}
              </Text>
              <Text
                style={[
                  styles.movEstado,
                  v.estado === 'completada' && { color: colors.success },
                  v.estado === 'cancelada' && { color: colors.danger },
                ]}
              >
                {v.estado}
              </Text>
            </View>
          </Pressable>
        ))
      )}

      {cliente.consignaciones.length > 0 ? (
        <>
          <SectionHeader titulo={`Consignaciones (${cliente.consignaciones.length})`} />
          {cliente.consignaciones.map((c) => (
            <Pressable
              key={`c-${c.id}`}
              style={styles.movCard}
              onPress={() => router.push(`/ventas/consignaciones/${c.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Consignación ${c.id}: por cobrar ${Number(c.saldo_pendiente).toFixed(2)} soles, estado ${c.estado}, ${formatearFecha(c.created_at)}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.movTitulo}>Consignación #{c.id}</Text>
                <Text style={styles.movMeta}>{formatearFecha(c.created_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.movMonto, { color: colors.porCobrar }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  S/ {Number(c.saldo_pendiente).toFixed(2)}
                </Text>
                <Text
                  style={[
                    styles.movEstado,
                    c.estado === 'liquidada' && { color: colors.success },
                    c.estado === 'parcial' && { color: colors.warning },
                    c.estado === 'pendiente' && { color: colors.porCobrar },
                  ]}
                >
                  por cobrar · {c.estado}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : null}

      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar cliente</Text>

            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={editNombre}
              onChangeText={setEditNombre}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Tipo de cliente</Text>
            <View style={{ marginBottom: spacing.sm }}>
              <Select
                value={editTipo}
                options={OPCIONES_TIPO}
                onChange={setEditTipo}
                accessibilityLabel="Tipo de cliente"
              />
            </View>

            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={styles.input}
              value={editTelefono}
              onChangeText={setEditTelefono}
              keyboardType="phone-pad"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>RUC o DNI</Text>
            <TextInput
              style={styles.input}
              value={editDocumento}
              onChangeText={setEditDocumento}
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
              maxLength={20}
            />

            <View style={styles.modalBotones}>
              <Pressable
                style={[styles.modalBoton, { backgroundColor: colors.border }]}
                onPress={() => setEditVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar edición"
              >
                <Text style={styles.modalBotonTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBoton, { backgroundColor: colors.primary }]}
                onPress={handleGuardarEdicion}
                disabled={guardando}
                accessibilityRole="button"
                accessibilityState={{ busy: guardando }}
                accessibilityLabel="Guardar cambios del cliente"
              >
                <Text style={[styles.modalBotonTexto, { color: colors.bg, fontWeight: '800' }]}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nombre: { color: colors.text, fontSize: 20, fontWeight: '800' },
  tipo: { color: colors.textMuted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  editButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  infoLabel: { color: colors.textMuted, fontSize: 13 },
  infoValor: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  ultimaVenta: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  actionText: { fontWeight: '700' },
  movCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  movTitulo: { color: colors.text, fontWeight: '700', fontSize: 14 },
  movMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  movMonto: { color: colors.text, fontWeight: '800', fontSize: 15 },
  movEstado: { color: colors.textMuted, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBotones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalBoton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  modalBotonTexto: { color: colors.text, fontWeight: '700' },
});

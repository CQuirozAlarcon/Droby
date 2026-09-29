import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';
import { useFinanzas } from '@/hooks/useFinanzas';
import { useConsignaciones } from '@/hooks/useConsignaciones';
import { useInventario } from '@/hooks/useInventario';
import { useEmpleados } from '@/hooks/useRRHH';
import { useFocusRefetch } from '@/hooks/useFocusRefetch';
import { supabase } from '@/lib/supabase';
import { fechaLocalISO } from '@/lib/fecha';
import { StatCard } from '@/components/StatCard';
import { SectionHeader } from '@/components/SectionHeader';
import { AlertRow } from '@/components/AlertRow';
import { EmptyState } from '@/components/EmptyState';

interface VentaHoy {
  id: number;
  total: number;
  cliente_id: number | null;
  created_at: string;
  clientes?: { nombre: string } | null;
}

function saludoPorHora(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function fechaLegibleHoy(): string {
  const texto = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function horaCorta(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Inicio del día de HOY en hora local, como ISO para comparar contra
// columnas timestamptz de Supabase.
function inicioDeHoyISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function InicioScreen() {
  const router = useRouter();
  const { session, rol, signOut } = useAuth();
  const { saldoDe, refetch: refetchFinanzas } = useFinanzas();
  const { pendientes, totalCuentasPorCobrar, refetch: refetchConsignaciones } = useConsignaciones();
  const { productosStockBajo, refetch: refetchInventario } = useInventario();
  const { empleados, refetch: refetchEmpleados } = useEmpleados();

  const [ventasHoy, setVentasHoy] = useState<VentaHoy[]>([]);
  const [entradasHoy, setEntradasHoy] = useState<number[]>([]); // empleado_ids que ya marcaron entrada
  const [cargandoResumen, setCargandoResumen] = useState(true);

  // Empleado vinculado a la cuenta logueada (para el saludo y la asistencia)
  const miEmpleado = empleados.find((e) => e.user_id === session?.user?.id);
  const nombreSaludo = miEmpleado?.nombre ?? session?.user?.email?.split('@')[0] ?? 'Equipo';

  // Carga las consultas directas del dashboard (ventas y asistencia de hoy).
  // Si una falla (RLS, red…), degrada a vacío: el inicio nunca debe romperse.
  const cargarResumen = useCallback(async () => {
    setCargandoResumen(true);
    const desde = inicioDeHoyISO();
    const [resVentas, resAsistencia] = await Promise.all([
      supabase
        .from('ventas')
        .select('id, total, cliente_id, created_at, clientes(nombre)')
        .eq('estado', 'completada')
        .gte('created_at', desde)
        .order('created_at', { ascending: false }),
      supabase.from('asistencia').select('empleado_id, tipo').gte('timestamp', desde),
    ]);
    if (!resVentas.error) setVentasHoy((resVentas.data as unknown as VentaHoy[]) ?? []);
    if (!resAsistencia.error) {
      setEntradasHoy(
        ((resAsistencia.data as { empleado_id: number; tipo: string }[]) ?? [])
          .filter((a) => a.tipo === 'entrada')
          .map((a) => a.empleado_id)
      );
    }
    setCargandoResumen(false);
  }, []);

  const refetchTodo = useCallback(() => {
    cargarResumen();
    refetchFinanzas();
    refetchConsignaciones();
    refetchInventario();
    refetchEmpleados();
  }, [cargarResumen, refetchFinanzas, refetchConsignaciones, refetchInventario, refetchEmpleados]);

  // Carga inicial de ventas y asistencia de hoy. useFocusRefetch salta el
  // primer focus (porque los hooks ya hacen su fetch inicial con useEffect),
  // pero `cargarResumen` es un useCallback propio: sin este useEffect, el
  // "Ventas de hoy" quedaba en '—' hasta que el usuario cambiara de pestaña
  // y volviera.
  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  // Recarga los KPIs cada vez que el usuario vuelve a esta pestaña
  useFocusRefetch(refetchTodo);

  // ---- Cálculos del día ----
  const totalHoy = ventasHoy.reduce((acc, v) => acc + Number(v.total), 0);
  const clientesHoy = new Set(ventasHoy.map((v) => v.cliente_id).filter((c) => c !== null)).size;
  const ultimasVentas = ventasHoy.slice(0, 5);

  const saldoEmpresa = saldoDe('empresa');
  const saldoPersonal = saldoDe('personal');

  // Consignaciones vencidas o que vencen en los próximos 3 días
  const hoyISO = fechaLocalISO();
  const en3Dias = new Date();
  en3Dias.setDate(en3Dias.getDate() + 3);
  const en3DiasISO = fechaLocalISO(en3Dias);
  const consignacionesCriticas = pendientes.filter(
    (c) => c.fecha_limite !== null && c.fecha_limite <= en3DiasISO
  );
  const consignacionesVencidas = consignacionesCriticas.filter((c) => c.fecha_limite! < hoyISO).length;

  // Empleados activos que aún no marcaron entrada hoy
  const sinEntrada = empleados.filter((e) => !entradasHoy.includes(e.id));
  const yoSinEntrada = miEmpleado !== undefined && !entradasHoy.includes(miEmpleado.id);

  const hayAlertas =
    productosStockBajo.length > 0 ||
    consignacionesCriticas.length > 0 ||
    (rol === 'admin' ? sinEntrada.length > 0 : yoSinEntrada);

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerMarca}>Elite Case</Text>
          <Text style={styles.headerFecha}>{fechaLegibleHoy()}</Text>
        </View>
        <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel="Cerrar sesión" hitSlop={8}>
          <Text style={styles.salir}>Salir</Text>
        </Pressable>
      </View>

      {/* Saludo */}
      <Text style={styles.saludo}>
        {saludoPorHora()}, <Text style={styles.saludoNombre}>{nombreSaludo}</Text>
      </Text>

      {/* KPI principal */}
      <StatCard
        grande
        label="Ventas de hoy"
        valor={cargandoResumen ? '—' : `S/ ${totalHoy.toFixed(2)}`}
        subInfo={`${ventasHoy.length} ${ventasHoy.length === 1 ? 'operación' : 'operaciones'} · ${clientesHoy} ${clientesHoy === 1 ? 'cliente' : 'clientes'}`}
        color={colors.primary}
        onPress={() => router.push('/ventas')}
        accessibilityLabel={`Ventas de hoy: ${totalHoy.toFixed(2)} soles, ${ventasHoy.length} operaciones. Ir a Ventas`}
      />

      {/* Cajas */}
      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <StatCard
            label="Empresa"
            valor={`S/ ${saldoEmpresa.toFixed(0)}`}
            color={colors.empresa}
            onPress={() => router.push('/finanzas')}
            accessibilityLabel={`Caja empresa: ${saldoEmpresa.toFixed(2)} soles. Ir a Finanzas`}
          />
        </View>
        {rol === 'admin' && (
          <>
            <View style={styles.chip}>
              <StatCard
                label="Personal"
                valor={`S/ ${saldoPersonal.toFixed(0)}`}
                color={colors.personal}
                onPress={() => router.push('/finanzas')}
                accessibilityLabel={`Caja personal: ${saldoPersonal.toFixed(2)} soles. Ir a Finanzas`}
              />
            </View>
            <View style={styles.chip}>
              <StatCard
                label="Por cobrar"
                valor={`S/ ${totalCuentasPorCobrar.toFixed(0)}`}
                color={colors.porCobrar}
                onPress={() => router.push('/ventas/consignaciones')}
                accessibilityLabel={`Cuentas por cobrar: ${totalCuentasPorCobrar.toFixed(2)} soles. Ir a Consignaciones`}
              />
            </View>
          </>
        )}
      </View>

      {/* Alertas operativas */}
      {hayAlertas && (
        <View style={styles.seccion}>
          <SectionHeader titulo="Alertas de hoy" />
          {productosStockBajo.length > 0 && (
            <AlertRow
              emoji="📦"
              color={colors.warning}
              texto={`${productosStockBajo.length} ${productosStockBajo.length === 1 ? 'producto bajo' : 'productos bajos'} de stock mínimo`}
              onPress={() => router.push('/inventario')}
            />
          )}
          {consignacionesCriticas.length > 0 && (
            <AlertRow
              emoji="⏰"
              color={consignacionesVencidas > 0 ? colors.danger : colors.warning}
              texto={
                consignacionesVencidas > 0
                  ? `${consignacionesVencidas} ${consignacionesVencidas === 1 ? 'consignación vencida' : 'consignaciones vencidas'} (${consignacionesCriticas.length} críticas en total)`
                  : `${consignacionesCriticas.length} ${consignacionesCriticas.length === 1 ? 'consignación vence' : 'consignaciones vencen'} en los próximos 3 días`
              }
              onPress={() => router.push('/ventas/consignaciones')}
            />
          )}
          {rol === 'admin' && sinEntrada.length > 0 && (
            <AlertRow
              emoji="👤"
              color={colors.primary}
              texto={`${sinEntrada.length} ${sinEntrada.length === 1 ? 'empleado no ha' : 'empleados no han'} marcado entrada hoy`}
              onPress={() => router.push('/rrhh/asistencia')}
            />
          )}
          {rol !== 'admin' && yoSinEntrada && (
            <AlertRow
              emoji="👤"
              color={colors.primary}
              texto="Aún no marcas tu entrada de hoy"
              onPress={() => router.push('/rrhh/asistencia')}
            />
          )}
        </View>
      )}

      {/* Actividad reciente */}
      <View style={styles.seccion}>
        <SectionHeader titulo="Actividad reciente" accionLabel="Ver ventas" onAccion={() => router.push('/ventas')} />
        {ultimasVentas.length === 0 ? (
          <EmptyState message={cargandoResumen ? 'Cargando…' : 'Sin ventas registradas hoy'} />
        ) : (
          ultimasVentas.map((v) => (
            <Pressable
              key={v.id}
              style={styles.ventaRow}
              onPress={() => router.push(`/ventas/${v.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Venta a ${v.clientes?.nombre ?? 'cliente sin nombre'} por ${Number(v.total).toFixed(2)} soles a las ${horaCorta(v.created_at)}`}
            >
              <Text style={styles.ventaHora}>{horaCorta(v.created_at)}</Text>
              <Text style={styles.ventaCliente} numberOfLines={1}>
                {v.clientes?.nombre ?? 'Cliente'}
              </Text>
              <Text style={styles.ventaTotal}>S/ {Number(v.total).toFixed(2)}</Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  headerMarca: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  headerFecha: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  salir: { color: colors.danger, fontSize: 13, fontWeight: '600', paddingVertical: spacing.sm, paddingLeft: spacing.md },
  saludo: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
  saludoNombre: { color: colors.primary },
  chipsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  chip: { flex: 1 },
  seccion: { marginTop: spacing.lg },
  ventaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  ventaHora: { color: colors.textMuted, fontSize: 12, fontWeight: '600', width: 44 },
  ventaCliente: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  ventaTotal: { color: colors.text, fontSize: 14, fontWeight: '800' },
});

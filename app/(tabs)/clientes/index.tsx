import { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useClientes } from '@/hooks/useClientes';
import { useFocusRefetch } from '@/hooks/useFocusRefetch';
import { EmptyState } from '@/components/EmptyState';
import { TipoCliente } from '@/types/database';

const TIPOS: { valor: TipoCliente | 'todos'; label: string }[] = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'mayorista', label: 'Mayorista' },
  { valor: 'minorista', label: 'Minorista' },
  { valor: 'vendedor', label: 'Vendedor' },
];

function formatearFechaCorta(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

export default function ClientesScreen() {
  const router = useRouter();
  const { clientes, loading, refetch } = useClientes();
  // al volver de crear/editar un cliente, la lista se refresca sola
  useFocusRefetch(refetch);

  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoCliente | 'todos'>('todos');

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return clientes.filter((c) => {
      const coincideBusqueda =
        termino === '' ||
        c.nombre.toLowerCase().includes(termino) ||
        (c.documento ?? '').toLowerCase().includes(termino) ||
        (c.telefono ?? '').toLowerCase().includes(termino);
      const coincideTipo = filtroTipo === 'todos' || c.tipo_cliente === filtroTipo;
      return coincideBusqueda && coincideTipo;
    });
  }, [clientes, busqueda, filtroTipo]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <TextInput
        style={styles.search}
        placeholder="Buscar por nombre, RUC/DNI o teléfono…"
        placeholderTextColor={colors.textMuted}
        value={busqueda}
        onChangeText={setBusqueda}
      />

      <View style={styles.filterRow}>
        {TIPOS.map((t) => (
          <Pressable
            key={t.valor}
            style={[styles.filterChip, filtroTipo === t.valor && styles.filterChipActive]}
            onPress={() => setFiltroTipo(t.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: filtroTipo === t.valor }}
            accessibilityLabel={`Filtrar por ${t.label}`}
          >
            <Text style={[styles.filterText, filtroTipo === t.valor && styles.filterTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        renderItem={({ item }) => {
          const resumenPartes: string[] = [];
          resumenPartes.push(item.tipo_cliente);
          if (item.documento) resumenPartes.push(item.documento);
          if (item.telefono) resumenPartes.push(item.telefono);
          const accesibilidad = `Cliente ${item.nombre}, tipo ${item.tipo_cliente}. ${item.numeroVentas} ${
            item.numeroVentas === 1 ? 'venta' : 'ventas'
          } por un total de ${item.totalVentas.toFixed(2)} soles.`;

          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/clientes/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={accesibilidad}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre} numberOfLines={1}>{item.nombre}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {resumenPartes.join(' · ')}
                </Text>
                {item.ultimaVenta && (
                  <Text style={styles.ultimaVenta}>Última venta: {formatearFechaCorta(item.ultimaVenta)}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  S/ {item.totalVentas.toFixed(2)}
                </Text>
                <Text style={styles.numVentas}>
                  {item.numeroVentas} {item.numeroVentas === 1 ? 'venta' : 'ventas'}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            message={
              loading
                ? 'Cargando…'
                : busqueda || filtroTipo !== 'todos'
                ? 'Sin clientes que coincidan con el filtro'
                : 'Aún no hay clientes. Toca + para registrar el primero.'
            }
          />
        }
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/clientes/nuevo')}
        accessibilityRole="button"
        accessibilityLabel="Agregar nuevo cliente"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: 12 },
  filterTextActive: { color: colors.bg, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nombre: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  ultimaVenta: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  total: { color: colors.text, fontWeight: '800', fontSize: 15 },
  numVentas: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
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
});

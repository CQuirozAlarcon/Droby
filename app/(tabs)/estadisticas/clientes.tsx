import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { useEstadisticas } from '@/hooks/useEstadisticas';
import { EmptyState } from '@/components/EmptyState';
import { BarChart } from '@/components/BarChart';
import { ViewToggle, VistaEstadistica } from '@/components/ViewToggle';
import { RankingCliente } from '@/hooks/useEstadisticas';

export default function EstadisticasClientesScreen() {
  const { rankingClientes, loading } = useEstadisticas();
  const [vista, setVista] = useState<VistaEstadistica>('grafica');
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

  if (rankingClientes.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
        <EmptyState message={loading ? 'Cargando...' : 'Aún no hay ventas para generar estadísticas'} />
      </View>
    );
  }

  const top15 = rankingClientes.slice(0, 15);

  function ModelosPreferidos({ cliente }: { cliente: RankingCliente }) {
    if (cliente.modelosPreferidos.length === 0) return null;
    return (
      <View style={styles.modelosBox}>
        <Text style={styles.modelosTitulo}>Modelos que más compra:</Text>
        {cliente.modelosPreferidos.slice(0, 4).map((m, i) => (
          <View key={i} style={styles.modeloFila}>
            <Text style={styles.modeloBullet}>{m.tipo === 'funda' ? '📱' : '🔌'}</Text>
            <Text style={styles.modeloNombre}>{m.modelo}</Text>
            <Text style={styles.modeloCantidad}>{m.cantidad} u.</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <ViewToggle vista={vista} onChange={setVista} />

      {vista === 'grafica' ? (
        <FlatList
          data={top15}
          keyExtractor={(item) => String(item.cliente_id)}
          ListHeaderComponent={
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Total comprado por cliente</Text>
              <BarChart
                datos={top15.map((c) => ({ label: c.nombre, valor: c.totalComprado }))}
                formatoValor={(v) => `S/ ${v.toFixed(0)}`}
              />
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.clienteCardCompacto} onPress={() => setExpandidoId(expandidoId === item.cliente_id ? null : item.cliente_id)}>
              <Text style={styles.clienteNombre}>{item.nombre}</Text>
              <Text style={styles.expandIcon}>{expandidoId === item.cliente_id ? '▲' : '▼'} modelos preferidos</Text>
              {expandidoId === item.cliente_id && <ModelosPreferidos cliente={item} />}
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={rankingClientes}
          keyExtractor={(item) => String(item.cliente_id)}
          renderItem={({ item, index }) => (
            <Pressable style={styles.card} onPress={() => setExpandidoId(expandidoId === item.cliente_id ? null : item.cliente_id)}>
              <View style={styles.row}>
                <Text style={styles.rank}>#{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clienteNombre}>{item.nombre}</Text>
                  <Text style={styles.numVentas}>{item.numeroVentas} venta(s)</Text>
                </View>
                <Text style={styles.total}>S/ {item.totalComprado.toFixed(2)}</Text>
              </View>
              {expandidoId === item.cliente_id && <ModelosPreferidos cliente={item} />}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  chartTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.md },
  clienteCardCompacto: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { color: colors.textMuted, fontWeight: '700', width: 28 },
  clienteNombre: { color: colors.text, fontWeight: '700', fontSize: 14 },
  numVentas: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  total: { color: colors.text, fontWeight: '800' },
  expandIcon: { color: colors.primary, fontSize: 11, marginTop: spacing.xs },
  modelosBox: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  modelosTitulo: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.xs },
  modeloFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  modeloBullet: { fontSize: 12 },
  modeloNombre: { color: colors.text, fontSize: 13, flex: 1 },
  modeloCantidad: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
});

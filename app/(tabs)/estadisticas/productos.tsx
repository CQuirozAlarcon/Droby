import { ScrollView } from 'react-native';
import { colors, spacing } from '@/lib/theme';
import { useEstadisticasProductos } from '@/hooks/useEstadisticas';
import { StatTable } from '@/components/StatTable';

export default function EstadisticasProductosScreen() {
  const { fundas, cargadores, loading } = useEstadisticasProductos();

  const columnas = [
    { key: 'modelo', label: 'Modelo', flex: 2 },
    { key: 'stock_actual', label: 'Stock' },
    { key: 'unidades_vendidas', label: 'Vendidas' },
    { key: 'ingresos', label: 'S/', render: (r: any) => r.ingresos.toFixed(0) },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <StatTable titulo={loading ? 'Fundas (cargando...)' : 'Fundas'} columnas={columnas} data={fundas} />
      <StatTable titulo={loading ? 'Cargadores (cargando...)' : 'Cargadores'} columnas={columnas} data={cargadores} />
    </ScrollView>
  );
}
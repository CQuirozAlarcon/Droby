import { ScrollView } from 'react-native';
import { colors, spacing } from '@/lib/theme';
import { useEstadisticasClientes } from '@/hooks/useEstadisticas';
import { StatTable } from '@/components/StatTable';

export default function EstadisticasClientesScreen() {
  const { clientes, loading } = useEstadisticasClientes();

  const columnas = [
    { key: 'nombre', label: 'Cliente', flex: 2 },
    { key: 'unidades_fundas', label: 'Fundas' },
    { key: 'unidades_cargadores', label: 'Carg.' },
    { key: 'total_comprado', label: 'Total S/', flex: 1.3, render: (r: any) => r.total_comprado.toFixed(0) },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <StatTable titulo={loading ? 'Clientes (cargando...)' : 'Ranking de clientes'} columnas={columnas} data={clientes} />
    </ScrollView>
  );
}
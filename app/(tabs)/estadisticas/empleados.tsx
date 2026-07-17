import { ScrollView } from 'react-native';
import { colors, spacing } from '@/lib/theme';
import { useEstadisticasEmpleados } from '@/hooks/useEstadisticas';
import { StatTable } from '@/components/StatTable';

export default function EstadisticasEmpleadosScreen() {
  const { empleados, loading } = useEstadisticasEmpleados();

  const columnas = [
    { key: 'nombre', label: 'Empleado', flex: 2 },
    { key: 'horas_totales', label: 'Horas', render: (r: any) => r.horas_totales.toFixed(1) },
    { key: 'total_pagado', label: 'Pagado S/', render: (r: any) => r.total_pagado.toFixed(0) },
    { key: 'adelantos_pendientes', label: 'Deuda S/', render: (r: any) => r.adelantos_pendientes.toFixed(0) },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <StatTable titulo={loading ? 'Empleados (cargando...)' : 'Empleados'} columnas={columnas} data={empleados} />
    </ScrollView>
  );
}
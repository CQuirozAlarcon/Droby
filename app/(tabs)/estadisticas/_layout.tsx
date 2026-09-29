import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function EstadisticasLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'Estadísticas' }} />
      <Stack.Screen name="productos" options={{ title: 'Top Productos' }} />
      <Stack.Screen name="clientes" options={{ title: 'Ranking de Clientes' }} />
      <Stack.Screen name="empleados" options={{ title: 'Estadísticas de Empleados' }} />
    </Stack>
  );
}

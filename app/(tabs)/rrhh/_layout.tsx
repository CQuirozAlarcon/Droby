import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function RRHHLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'RRHH' }} />
      <Stack.Screen name="empleados" options={{ title: 'Empleados' }} />
      <Stack.Screen name="empleado/[id]" options={{ title: 'Detalle Empleado' }} />
      <Stack.Screen name="asistencia" options={{ title: 'Asistencia' }} />
      <Stack.Screen name="adelantos" options={{ title: 'Adelantos' }} />
      <Stack.Screen name="nomina" options={{ title: 'Nómina' }} />
    </Stack>
  );
}

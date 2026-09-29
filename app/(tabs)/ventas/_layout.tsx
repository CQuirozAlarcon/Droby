import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function VentasLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'Ventas' }} />
      <Stack.Screen name="nueva" options={{ title: 'Nueva Venta', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle de Venta' }} />
      <Stack.Screen name="consignaciones/index" options={{ title: 'Consignaciones' }} />
      <Stack.Screen name="consignaciones/[id]" options={{ title: 'Detalle de Consignación' }} />
    </Stack>
  );
}

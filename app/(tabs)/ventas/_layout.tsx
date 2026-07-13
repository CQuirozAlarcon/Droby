import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function VentasLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'Ventas' }} />
      <Stack.Screen name="nueva" options={{ title: 'Nueva Venta', presentation: 'modal' }} />
    </Stack>
  );
}

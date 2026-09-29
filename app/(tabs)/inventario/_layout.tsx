import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function InventarioLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'Inventario' }} />
      <Stack.Screen name="nuevo" options={{ title: 'Nuevo Producto', presentation: 'modal' }} />
      <Stack.Screen name="matricial" options={{ title: 'Cases — Matriz Modelos × Colores' }} />
      <Stack.Screen name="cargadores" options={{ title: 'Cargadores — Lista' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle Producto' }} />
    </Stack>
  );
}

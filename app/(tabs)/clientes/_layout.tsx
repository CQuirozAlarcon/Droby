import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function ClientesLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'Clientes' }} />
      <Stack.Screen name="nuevo" options={{ title: 'Nuevo Cliente', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle de Cliente' }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function FinanzasLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'Finanzas' }} />
    </Stack>
  );
}

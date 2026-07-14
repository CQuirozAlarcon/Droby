import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/lib/theme';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', tabBarIcon: () => <TabIcon emoji="🏠" /> }}
      />
      <Tabs.Screen
        name="inventario"
        options={{ title: 'Inventario', tabBarIcon: () => <TabIcon emoji="📦" /> }}
      />
      <Tabs.Screen
        name="ventas"
        options={{ title: 'Ventas', tabBarIcon: () => <TabIcon emoji="🛒" /> }}
      />
      <Tabs.Screen
        name="finanzas"
        options={{ title: 'Finanzas', tabBarIcon: () => <TabIcon emoji="💰" /> }}
      />
      <Tabs.Screen
        name="rrhh"
        options={{ title: 'RRHH', tabBarIcon: () => <TabIcon emoji="👥" /> }}
      />
    </Tabs>
  );
}

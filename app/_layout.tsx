import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthContext, useAuthState } from '@/hooks/useAuth';
import { colors } from '@/lib/theme';
import { FeedbackHost } from '@/components/FeedbackHost';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const auth = useAuthState();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (auth.loading) return;
    const enAuth = segments[0] === '(auth)';
    if (!auth.session && !enAuth) {
      router.replace('/(auth)/login');
    } else if (auth.session && enAuth) {
      router.replace('/(tabs)');
    }
  }, [auth.session, auth.loading, segments, router]);

  if (auth.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
      {/* Avisos globales (toast + confirmaciones) del tema oscuro */}
      <FeedbackHost />
    </AuthContext.Provider>
  );
}

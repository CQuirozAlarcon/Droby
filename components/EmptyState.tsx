import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/lib/theme';

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.container} accessible accessibilityRole="text" accessibilityLabel={message}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, alignItems: 'center' },
  text: { color: colors.textMuted, textAlign: 'center' },
});

import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

interface Props {
  label: string;
  value: string;
  accentColor?: string;
}

export function StatCard({ label, value, accentColor = colors.primary }: Props) {
  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flex: 1,
    borderLeftWidth: 4,
    minWidth: 140,
  },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  value: { color: colors.text, fontSize: 22, fontWeight: '700' },
});

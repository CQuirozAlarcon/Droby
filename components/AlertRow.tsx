import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

interface AlertRowProps {
  emoji: string;
  texto: string;
  /** Color del punto/emoji de estado (warning, danger, primary…) */
  color?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}

// Fila de alerta operativa del dashboard ("4 productos con stock bajo",
// "2 consignaciones por vencer"…). Toda la fila es táctil y navega a la
// pantalla donde se resuelve el problema.
export function AlertRow({ emoji, texto, color = colors.warning, onPress, accessibilityLabel }: AlertRowProps) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel ?? texto}
    >
      <View style={[styles.punto, { backgroundColor: color }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{emoji}</Text>
      <Text style={styles.texto} numberOfLines={2}>{texto}</Text>
      {onPress ? (
        <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">›</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  emoji: { fontSize: 15 },
  texto: { color: colors.text, fontSize: 13, flex: 1, fontWeight: '500' },
  chevron: { color: colors.textMuted, fontSize: 18 },
});

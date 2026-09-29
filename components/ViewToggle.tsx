import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

export type VistaEstadistica = 'tabla' | 'grafica';

interface Props {
  vista: VistaEstadistica;
  onChange: (v: VistaEstadistica) => void;
}

export function ViewToggle({ vista, onChange }: Props) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {(['grafica', 'tabla'] as const).map((v) => (
        <Pressable
          key={v}
          style={[styles.option, vista === v && styles.optionActive]}
          onPress={() => onChange(v)}
          accessibilityRole="tab"
          accessibilityLabel={v === 'grafica' ? 'Ver como gráfica' : 'Ver como tabla'}
          accessibilityState={{ selected: vista === v }}
        >
          <Text style={[styles.text, vista === v && styles.textActive]}>
            {v === 'grafica' ? '📊 Gráfica' : '📋 Tabla'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  option: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  optionActive: { backgroundColor: colors.primary },
  text: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  textActive: { color: colors.bg },
});

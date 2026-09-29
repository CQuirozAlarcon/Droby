import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/lib/theme';

interface SectionHeaderProps {
  titulo: string;
  /** Texto de la acción a la derecha (ej. "Ver todo") */
  accionLabel?: string;
  onAccion?: () => void;
}

// Encabezado de sección del dashboard: título a la izquierda y acción
// opcional a la derecha ("Ver todo →").
export function SectionHeader({ titulo, accionLabel, onAccion }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.titulo} accessibilityRole="header">{titulo}</Text>
      {accionLabel && onAccion ? (
        <Pressable onPress={onAccion} accessibilityRole="button" accessibilityLabel={accionLabel} hitSlop={8}>
          <Text style={styles.accion}>{accionLabel} →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titulo: { color: colors.text, fontWeight: '700', fontSize: 15 },
  accion: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});

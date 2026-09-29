import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

interface StatCardProps {
  /** Etiqueta pequeña en mayúsculas (ej. "VENTAS DE HOY") */
  label: string;
  /** Número principal (ej. "S/ 1,240") */
  valor: string;
  /** Micro-info debajo del número (ej. "8 operaciones · 3 clientes") */
  subInfo?: string;
  /** Color de la barra lateral y del valor (por defecto: primary) */
  color?: string;
  /** Tipografía grande (KPI principal) o mediana (chips) */
  grande?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

// Tarjeta de KPI del dashboard. Estilo sobrio tipo Linear/Vercel: borde
// sutil, barra de color a la izquierda y jerarquía por tamaño de fuente.
export function StatCard({ label, valor, subInfo, color = colors.primary, grande = false, onPress, accessibilityLabel }: StatCardProps) {
  const accesible = accessibilityLabel ?? `${label}: ${valor}${subInfo ? `. ${subInfo}` : ''}`;

  const contenido = (
    <>
      <View style={[styles.barra, { backgroundColor: color }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <View style={styles.cuerpo}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        <Text style={[styles.valor, grande ? styles.valorGrande : styles.valorMediano, { color }]} numberOfLines={1} adjustsFontSizeToFit>
          {valor}
        </Text>
        {subInfo ? <Text style={styles.subInfo} numberOfLines={2}>{subInfo}</Text> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={accesible}>
        {contenido}
      </Pressable>
    );
  }
  return (
    <View style={styles.card} accessibilityRole="text" accessibilityLabel={accesible}>
      {contenido}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  barra: { width: 3 },
  cuerpo: { flex: 1, padding: spacing.md },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  valor: { fontWeight: '800', marginTop: spacing.xs },
  valorGrande: { fontSize: 40, letterSpacing: -1 },
  valorMediano: { fontSize: 20 },
  subInfo: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
});

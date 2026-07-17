import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';

const OPCIONES = [
  { ruta: '/estadisticas/productos', titulo: 'Productos', emoji: '📦', desc: 'Fundas y cargadores por separado' },
  { ruta: '/estadisticas/clientes', titulo: 'Clientes', emoji: '🧾', desc: 'Quién compra más y qué prefiere' },
  { ruta: '/estadisticas/empleados', titulo: 'Empleados', emoji: '👥', desc: 'Horas trabajadas y pagos' },
] as const;

export default function EstadisticasIndexScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      {OPCIONES.map((op) => (
        <Pressable key={op.ruta} style={styles.card} onPress={() => router.push(op.ruta)}>
          <Text style={styles.emoji}>{op.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>{op.titulo}</Text>
            <Text style={styles.desc}>{op.desc}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  emoji: { fontSize: 28 },
  titulo: { color: colors.text, fontWeight: '700', fontSize: 16 },
  desc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
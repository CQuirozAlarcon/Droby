import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';

const OPCIONES = [
  { ruta: '/rrhh/empleados', titulo: 'Empleados', emoji: '🧑‍💼', desc: 'Lista, salarios, nómina y adelantos por empleado' },
  { ruta: '/rrhh/asistencia', titulo: 'Asistencia', emoji: '🕒', desc: 'Marcar entrada/salida y ver historial' },
  { ruta: '/rrhh/adelantos', titulo: 'Adelantos', emoji: '💵', desc: 'Registrar adelantos de sueldo' },
  { ruta: '/rrhh/nomina', titulo: 'Nómina', emoji: '📋', desc: 'Generar y pagar nómina semanal' },
] as const;

export default function RRHHIndexScreen() {
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  emoji: { fontSize: 28 },
  titulo: { color: colors.text, fontWeight: '700', fontSize: 16 },
  desc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});

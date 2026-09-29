import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';

const OPCIONES = [
  { ruta: '/rrhh/empleados', titulo: 'Empleados', emoji: '🧑‍💼', desc: 'Lista, salarios, nómina y adelantos por empleado', soloAdmin: false },
  { ruta: '/rrhh/asistencia', titulo: 'Asistencia', emoji: '🕒', desc: 'Marcar entrada/salida y ver historial', soloAdmin: false },
  { ruta: '/rrhh/adelantos', titulo: 'Adelantos', emoji: '💵', desc: 'Registrar adelantos de sueldo', soloAdmin: true },
  { ruta: '/rrhh/nomina', titulo: 'Nómina', emoji: '📋', desc: 'Generar y pagar nómina semanal', soloAdmin: true },
] as const;

export default function RRHHIndexScreen() {
  const router = useRouter();
  const { rol } = useAuth();
  const opcionesVisibles = OPCIONES.filter((op) => !op.soloAdmin || rol === 'admin');
  return (
    <View style={styles.container}>
      {opcionesVisibles.map((op) => (
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
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  emoji: { fontSize: 28 },
  titulo: { color: colors.text, fontWeight: '700', fontSize: 16 },
  desc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});

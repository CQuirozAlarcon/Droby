import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';

const OPCIONES = [
  { ruta: '/estadisticas/productos', titulo: 'Productos', emoji: '📦', desc: 'Modelos más vendidos, en tabla o gráfica', soloAdmin: false },
  { ruta: '/estadisticas/clientes', titulo: 'Clientes', emoji: '🧑‍🤝‍🧑', desc: 'Ranking de clientes y qué modelos prefiere cada uno', soloAdmin: false },
  { ruta: '/estadisticas/empleados', titulo: 'Empleados', emoji: '🧑‍💼', desc: 'Horas trabajadas y pagos por empleado', soloAdmin: true },
] as const;

export default function EstadisticasIndexScreen() {
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
          <Text style={styles.chevron}>›</Text>
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
  chevron: { color: colors.textMuted, fontSize: 22 },
});

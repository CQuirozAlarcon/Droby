import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/lib/theme';

// Aviso para pantallas exclusivas del rol admin. Reemplaza los errores
// crudos de RLS ("new row violates row-level security policy") y las
// listas vacías engañosas que antes veía un usuario con rol empleado.
export function SoloAdmin() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔒</Text>
      <Text style={styles.titulo}>Solo administradores</Text>
      <Text style={styles.texto}>
        Esta sección está disponible únicamente para usuarios con rol de administrador.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emoji: { fontSize: 40, marginBottom: spacing.md },
  titulo: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  texto: { color: colors.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 280 },
});

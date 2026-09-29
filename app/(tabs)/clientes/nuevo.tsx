import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/lib/theme';
import { useClientes } from '@/hooks/useClientes';
import { Select } from '@/components/Select';
import { TipoCliente } from '@/types/database';
import { showAlert } from '@/lib/alert';

const OPCIONES_TIPO: { label: string; value: TipoCliente }[] = [
  { label: 'Mayorista', value: 'mayorista' },
  { label: 'Minorista', value: 'minorista' },
  { label: 'Vendedor', value: 'vendedor' },
];

export default function NuevoClienteScreen() {
  const router = useRouter();
  const { crearCliente } = useClientes();

  const [nombre, setNombre] = useState('');
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>('mayorista');
  const [telefono, setTelefono] = useState('');
  const [documento, setDocumento] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function handleGuardar() {
    const nombreTrim = nombre.trim();
    if (!nombreTrim) {
      showAlert('Falta el nombre', 'Ingresa el nombre del cliente');
      return;
    }
    setGuardando(true);
    try {
      await crearCliente({
        nombre: nombreTrim,
        tipo_cliente: tipoCliente,
        telefono: telefono.trim() || null,
        documento: documento.trim() || null,
      });
      router.back();
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nombre *</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Ej: Juan Pérez"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoFocus
        />

        <Text style={styles.label}>Tipo de cliente</Text>
        <View style={{ marginBottom: spacing.sm }}>
          <Select
            value={tipoCliente}
            options={OPCIONES_TIPO}
            onChange={setTipoCliente}
            accessibilityLabel="Tipo de cliente"
          />
        </View>

        <Text style={styles.label}>Teléfono (opcional)</Text>
        <TextInput
          style={styles.input}
          value={telefono}
          onChangeText={setTelefono}
          placeholder="987654321"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>RUC o DNI (opcional)</Text>
        <TextInput
          style={styles.input}
          value={documento}
          onChangeText={setDocumento}
          placeholder="20123456789"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          maxLength={20}
        />
        <Text style={styles.hint}>
          Lo guardamos para identificar al cliente y, más adelante, generar facturas.
        </Text>

        <View style={styles.botones}>
          <Pressable
            style={[styles.boton, styles.botonCancelar]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
          >
            <Text style={styles.textoCancelar}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[styles.boton, styles.botonGuardar]}
            onPress={handleGuardar}
            disabled={guardando}
            accessibilityRole="button"
            accessibilityState={{ busy: guardando }}
            accessibilityLabel="Guardar cliente"
          >
            <Text style={styles.textoGuardar}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },
  botones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  boton: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  botonCancelar: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  textoCancelar: { color: colors.text, fontWeight: '600' },
  botonGuardar: { backgroundColor: colors.primary },
  textoGuardar: { color: colors.bg, fontWeight: '800' },
});

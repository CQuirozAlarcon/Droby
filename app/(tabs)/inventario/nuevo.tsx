import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, MODELOS_IPHONE } from '@/lib/theme';
import { useInventario } from '@/hooks/useInventario';
import { TipoProducto } from '@/types/database';

const OTRO_MODELO = '__OTRO__';

export default function NuevoProductoScreen() {
  const router = useRouter();
  const { crearProducto } = useInventario();

  const [tipo, setTipo] = useState<TipoProducto>('funda');
  const [modeloSeleccionado, setModeloSeleccionado] = useState<string>(MODELOS_IPHONE[0]);
  const [modeloPersonalizado, setModeloPersonalizado] = useState('');
  const [variante, setVariante] = useState('');
  const [stockInicial, setStockInicial] = useState('0');
  const [stockMinimo, setStockMinimo] = useState('10');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const usaModeloPersonalizado = modeloSeleccionado === OTRO_MODELO;
  const modeloFinal = usaModeloPersonalizado ? modeloPersonalizado.trim() : modeloSeleccionado;

  async function handleGuardar() {
    if (!precio || !costo) {
      Alert.alert('Faltan datos', 'Precio y costo son obligatorios');
      return;
    }
    if (!modeloFinal) {
      Alert.alert('Falta el modelo', 'Escribe el nombre del modelo');
      return;
    }
    setGuardando(true);
    try {
      await crearProducto({
        tipo,
        modelo: modeloFinal,
        variante: tipo === 'cargador' ? variante || null : null,
        stock_actual: parseInt(stockInicial || '0', 10),
        stock_minimo: parseInt(stockMinimo || '10', 10),
        precio_unitario: parseFloat(precio),
        costo_unitario: parseFloat(costo),
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Tipo</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={tipo} onValueChange={setTipo} dropdownIconColor={colors.text}>
          <Picker.Item label="Funda" value="funda" color={colors.text} />
          <Picker.Item label="Cargador" value="cargador" color={colors.text} />
        </Picker>
      </View>

      <Text style={styles.label}>Modelo</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={modeloSeleccionado} onValueChange={setModeloSeleccionado} dropdownIconColor={colors.text}>
          {MODELOS_IPHONE.map((m) => (
            <Picker.Item key={m} label={m} value={m} color={colors.text} />
          ))}
          <Picker.Item label="Otro (escribir manualmente)" value={OTRO_MODELO} color={colors.text} />
        </Picker>
      </View>

      {usaModeloPersonalizado && (
        <>
          <Text style={styles.label}>Nombre del modelo</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. iPhone 17 Pro Max"
            placeholderTextColor={colors.textMuted}
            value={modeloPersonalizado}
            onChangeText={setModeloPersonalizado}
          />
        </>
      )}

      {tipo === 'cargador' && (
        <>
          <Text style={styles.label}>Variante (ej. Lightning 20W)</Text>
          <TextInput style={styles.input} value={variante} onChangeText={setVariante} placeholderTextColor={colors.textMuted} />
        </>
      )}

      <Text style={styles.label}>Stock inicial</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={stockInicial} onChangeText={setStockInicial} />

      <Text style={styles.label}>Stock mínimo (alerta)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={stockMinimo} onChangeText={setStockMinimo} />

      <Text style={styles.label}>Precio de venta (S/)</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={precio} onChangeText={setPrecio} />

      <Text style={styles.label}>Costo unitario (S/)</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={costo} onChangeText={setCosto} />

      <Pressable style={styles.button} onPress={handleGuardar} disabled={guardando}>
        <Text style={styles.buttonText}>{guardando ? 'Guardando...' : 'Guardar producto'}</Text>
      </Pressable>
    </ScrollView>
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
  pickerWrapper: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonText: { color: colors.bg, fontWeight: '700' },
});

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { colors, radius, spacing, MODELOS_IPHONE, COLORES_UNIVERSALES, COLOR_SIN_VARIANTE } from '@/lib/theme';
import { useInventario } from '@/hooks/useInventario';
import { TipoProducto } from '@/types/database';
import { showAlert } from '@/lib/alert';
import { Select } from '@/components/Select';

const OTRO_MODELO = '__OTRO__';
const COLOR_UNICO = 'Único color';

// ---------------------------------------------------------------------------
// Nuevo producto (flujo manual, para casos atípicos).
//
// Convención alineada al punto de venta en paleta:
//   • Funda: una fila por (modelo, color) → `variante` = color de la paleta
//     universal ("Sin color" para fundas cargadas sin variante).
//   • Cargador: `modelo` = "Marca Watts" (ej. "Samsung 65W") y `variante` =
//     color; "Único color" deja variante NULL (ej. cargadores Apple).
// Para altas masivas usa las vistas dedicadas (matriz de cases / lista de
// cargadores) desde la pantalla de Inventario.
// ---------------------------------------------------------------------------

export default function NuevoProductoScreen() {
  const { crearProducto } = useInventario();

  const [tipo, setTipo] = useState<TipoProducto>('funda');

  // funda
  const [modeloSeleccionado, setModeloSeleccionado] = useState<string>(MODELOS_IPHONE[0]);
  const [modeloPersonalizado, setModeloPersonalizado] = useState('');
  const [colorFunda, setColorFunda] = useState<string>(COLORES_UNIVERSALES[0].nombre);

  // cargador
  const [modeloCargador, setModeloCargador] = useState('');
  const [colorCargador, setColorCargador] = useState<string>(COLOR_UNICO);

  const [stockInicial, setStockInicial] = useState('0');
  const [stockMinimo, setStockMinimo] = useState('10');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const usaModeloPersonalizado = modeloSeleccionado === OTRO_MODELO;
  const modeloFinal =
    tipo === 'funda'
      ? usaModeloPersonalizado
        ? modeloPersonalizado.trim()
        : modeloSeleccionado
      : modeloCargador.trim();
  const colorFinal = tipo === 'funda' ? colorFunda : colorCargador;

  async function handleGuardar() {
    if (!precio || !costo) return showAlert('Faltan datos', 'Precio y costo son obligatorios');
    if (!modeloFinal) {
      return showAlert('Falta el modelo', tipo === 'funda' ? 'Escribe el nombre del modelo' : 'Escribe la marca y potencia (ej. Samsung 65W)');
    }

    setGuardando(true);
    try {
      await crearProducto({
        tipo,
        modelo: modeloFinal,
        variante:
          colorFinal === COLOR_UNICO || colorFinal === COLOR_SIN_VARIANTE ? null : colorFinal,
        stock_actual: parseInt(stockInicial || '0', 10),
        stock_minimo: parseInt(stockMinimo || '10', 10),
        precio_unitario: parseFloat(precio),
        costo_unitario: parseFloat(costo),
      });
      showAlert('Producto creado', `${modeloFinal}${colorFinal !== COLOR_UNICO ? ` · ${colorFinal}` : ''}`);
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Tipo</Text>
      <Select<TipoProducto>
        value={tipo}
        options={[
          { label: '📱 Funda (case)', value: 'funda' },
          { label: '🔌 Cargador', value: 'cargador' },
        ]}
        onChange={setTipo}
        accessibilityLabel="Tipo de producto"
      />

      {tipo === 'funda' ? (
        <>
          <Text style={styles.label}>Modelo</Text>
          <Select<string>
            value={modeloSeleccionado}
            options={[
              ...MODELOS_IPHONE.map((m) => ({ label: m, value: m })),
              { label: 'Otro (escribir manualmente)', value: OTRO_MODELO },
            ]}
            onChange={setModeloSeleccionado}
            accessibilityLabel="Modelo del teléfono"
          />

          {usaModeloPersonalizado && (
            <>
              <Text style={styles.label}>Nombre del modelo</Text>
              <TextInput style={styles.input} placeholder="Ej. iPhone 17 Pro Max" placeholderTextColor={colors.textMuted} value={modeloPersonalizado} onChangeText={setModeloPersonalizado} />
            </>
          )}

          <Text style={styles.label}>Color (paleta universal)</Text>
          <Select<string>
            value={colorFunda}
            options={[
              ...COLORES_UNIVERSALES.map((c) => ({ label: c.nombre, value: c.nombre })),
              { label: COLOR_SIN_VARIANTE, value: COLOR_SIN_VARIANTE },
            ]}
            onChange={setColorFunda}
            accessibilityLabel="Color de la funda"
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Marca y potencia</Text>
          <TextInput style={styles.input} placeholder="Ej. Samsung 65W" placeholderTextColor={colors.textMuted} value={modeloCargador} onChangeText={setModeloCargador} />
          <Text style={styles.hintSmall}>Este será el nombre del objeto en el punto de venta (id · marca · color · watts · precio).</Text>

          <Text style={styles.label}>Color</Text>
          <Select<string>
            value={colorCargador}
            options={[
              { label: COLOR_UNICO, value: COLOR_UNICO },
              { label: 'Negro', value: 'Negro' },
              { label: 'Blanco', value: 'Blanco' },
            ]}
            onChange={setColorCargador}
            accessibilityLabel="Color del cargador"
          />
          <Text style={styles.hintSmall}>Los cargadores con 2 colores se agregan como dos ítems (uno por color).</Text>
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
  hintSmall: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  buttonText: { color: colors.bg, fontWeight: '700' },
});

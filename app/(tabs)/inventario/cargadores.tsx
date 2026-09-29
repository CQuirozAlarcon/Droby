import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { useInventario } from '@/hooks/useInventario';
import { useAuth } from '@/hooks/useAuth';
import { SoloAdmin } from '@/components/SoloAdmin';
import { showAlert } from '@/lib/alert';
import { Select } from '@/components/Select';
import { Producto } from '@/types/database';

// ---------------------------------------------------------------------------
// MOTOR DE INVENTARIO — Vista de LISTA de cargadores (solo admin).
//
// Lista simple (catálogo de hasta 15 tipos) para actualizar stock rápido:
// cada ítem es un objeto del tipo  id · Marca Watts · color · precio.
// Algunos cargadores vienen en 2 colores (blanco y negro) → se crean como
// dos ítems; otros, como los de Apple, en un único color.
//
// Convención: modelo = "Marca Watts" (ej. "Samsung 65W") y variante = color
// ("Negro"/"Blanco"); sin variante = único color.
// ---------------------------------------------------------------------------

const MAX_TIPOS = 15;
const MARCA_OTRA = '__OTRA__';
const MARCAS = ['Samsung', 'Apple', 'Xiaomi', 'Motorola', 'Realme', 'Generica'];
const COLORES_CARGADOR = ['Negro', 'Blanco'];

export default function InventarioCargadoresScreen() {
  const { rol } = useAuth();
  const { productos, ajustarStock, crearProducto, refetch } = useInventario();

  // stock rápido por ítem: productoId → texto
  const [entradasStock, setEntradasStock] = useState<Record<number, string>>({});
  const [guardandoStock, setGuardandoStock] = useState<number | null>(null);

  // formulario nuevo cargador
  const [marca, setMarca] = useState<string>(MARCAS[0]);
  const [marcaOtra, setMarcaOtra] = useState('');
  const [watts, setWatts] = useState('');
  const [coloresElegidos, setColoresElegidos] = useState<string[]>([]);
  const [stockInicial, setStockInicial] = useState('0');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargadores = useMemo(() => productos.filter((p) => p.tipo === 'cargador'), [productos]);

  const marcaFinal = marca === MARCA_OTRA ? marcaOtra.trim() : marca;
  const modeloFinal = [marcaFinal, watts.trim()].filter(Boolean).join(' ');
  const usaMarcaOtra = marca === MARCA_OTRA;

  async function agregarStock(producto: Producto) {
    const texto = entradasStock[producto.id] ?? '';
    const cantidad = parseInt(texto, 10);
    if (!cantidad || cantidad <= 0) {
      showAlert('Cantidad inválida', `Escribe cuántas unidades entran de ${producto.modelo}`);
      return;
    }
    setGuardandoStock(producto.id);
    try {
      await ajustarStock(producto.id, cantidad, 'Entrada de stock — vista de lista de cargadores');
      setEntradasStock((prev) => ({ ...prev, [producto.id]: '' }));
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardandoStock(null);
    }
  }

  function toggleColor(color: string) {
    setColoresElegidos((prev) => (prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]));
  }

  async function crearCargador() {
    const stockNum = parseInt(stockInicial || '0', 10);
    const precioNum = parseFloat(precio);
    const costoNum = parseFloat(costo);

    if (!marcaFinal) return showAlert('Falta la marca', 'Escribe la marca del cargador');
    if (!modeloFinal) return showAlert('Faltan datos', 'Indica al menos la marca (puedes dejar los watts vacíos)');
    if (!precioNum || !costoNum) return showAlert('Faltan datos', 'Precio y costo son obligatorios');
    if (cargadores.length + coloresElegidos.length > MAX_TIPOS) {
      return showAlert('Catálogo lleno', `El catálogo admite hasta ${MAX_TIPOS} tipos de cargador`);
    }

    // Colores seleccionados: 2 colores → un ítem por color; ninguno → único color.
    const variantes = coloresElegidos.length > 0 ? coloresElegidos : [null];
    const duplicados = variantes.filter((color) =>
      cargadores.some((p) => p.modelo.toLowerCase() === modeloFinal.toLowerCase() && (p.variante ?? '') === (color ?? ''))
    );
    if (duplicados.length > 0) {
      return showAlert('Ya existe', `"${modeloFinal}" ya está en el catálogo con ese color`);
    }

    setGuardando(true);
    try {
      for (const color of variantes) {
        await crearProducto({
          tipo: 'cargador',
          modelo: modeloFinal,
          variante: color,
          stock_actual: stockNum,
          precio_unitario: precioNum,
          costo_unitario: costoNum,
        });
      }
      showAlert('Cargador agregado', `${modeloFinal} — ${variantes.length} variante(s)`);
      setWatts('');
      setColoresElegidos([]);
      setStockInicial('0');
      setPrecio('');
      setCosto('');
      refetch();
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (rol !== 'admin') return <SoloAdmin />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Catálogo de cargadores ({cargadores.length}/{MAX_TIPOS})</Text>
      <Text style={styles.hint}>
        Ingresa las unidades que ENTRAN y confirma por línea. El precio se edita tocando el ítem en la lista general.
      </Text>

      {cargadores.map((p) => (
        <View key={p.id} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemNombre} numberOfLines={1}>
              🔌 {p.modelo}
            </Text>
            <Text style={styles.itemSub}>
              #{String(p.id).padStart(3, '0')} · {p.variante ?? 'Único color'} · S/ {p.precio_unitario.toFixed(2)} · stock: {p.stock_actual}
            </Text>
          </View>
          <TextInput
            style={styles.stockInput}
            keyboardType="numeric"
            placeholder="+0"
            placeholderTextColor={colors.textMuted}
            value={entradasStock[p.id] ?? ''}
            onChangeText={(t) => setEntradasStock((prev) => ({ ...prev, [p.id]: t.replace(/[^0-9]/g, '') }))}
            returnKeyType="next"
            blurOnSubmit={false}
            accessibilityLabel={`Unidades que entran de ${p.modelo}`}
          />
          <Pressable
            style={[styles.stockBoton, guardandoStock === p.id && { opacity: 0.5 }]}
            onPress={() => agregarStock(p)}
            disabled={guardandoStock === p.id}
            accessibilityRole="button"
            accessibilityLabel={`Agregar stock de ${p.modelo}`}
          >
            <Text style={styles.stockBotonTexto}>{guardandoStock === p.id ? '…' : '＋'}</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Nuevo cargador</Text>
      <Text style={styles.hint}>
        Ej.: marca Samsung, 65W, color negro, precio 12. Si eliges 2 colores se crean dos ítems (uno por color);
        sin color seleccionado se crea un único ítem (ej. cargadores Apple).
      </Text>

      <Text style={styles.fieldLabel}>Marca</Text>
      <Select<string>
        value={marca}
        options={[...MARCAS.map((m) => ({ label: m, value: m })), { label: 'Otra (escribir)', value: MARCA_OTRA }]}
        onChange={setMarca}
        accessibilityLabel="Marca del cargador"
      />
      {usaMarcaOtra && (
        <>
          <Text style={styles.fieldLabel}>Nombre de la marca</Text>
          <TextInput style={styles.input} value={marcaOtra} onChangeText={setMarcaOtra} placeholder="Ej. Anker" placeholderTextColor={colors.textMuted} />
        </>
      )}

      <Text style={styles.fieldLabel}>Potencia (watts, opcional)</Text>
      <TextInput style={styles.input} value={watts} onChangeText={setWatts} placeholder="Ej. 65W" placeholderTextColor={colors.textMuted} />

      <Text style={styles.fieldLabel}>Color(es)</Text>
      <View style={styles.colorRow}>
        {COLORES_CARGADOR.map((color) => {
          const elegido = coloresElegidos.includes(color);
          return (
            <Pressable
              key={color}
              style={[styles.colorChip, elegido && styles.colorChipActivo]}
              onPress={() => toggleColor(color)}
              accessibilityRole="button"
              accessibilityLabel={`Color ${color}`}
              accessibilityState={{ selected: elegido }}
            >
              <Text style={[styles.colorChipTexto, elegido && styles.colorChipTextoActivo]}>{color}</Text>
            </Pressable>
          );
        })}
        <Text style={styles.colorHint}>…o ninguno = único color</Text>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Stock inicial</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={stockInicial} onChangeText={setStockInicial} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Precio (S/)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={precio} onChangeText={setPrecio} placeholder="Ej. 12" placeholderTextColor={colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Costo (S/)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={costo} onChangeText={setCosto} placeholder="Ej. 7" placeholderTextColor={colors.textMuted} />
        </View>
      </View>

      {modeloFinal ? <Text style={styles.preview}>Se creará: {modeloFinal}{coloresElegidos.length > 0 ? ` — ${coloresElegidos.join(' + ')}` : ' — único color'}</Text> : null}

      <Pressable style={styles.button} onPress={crearCargador} disabled={guardando} accessibilityRole="button" accessibilityLabel="Crear cargador">
        <Text style={styles.buttonText}>{guardando ? 'Guardando...' : 'Agregar al catálogo'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xs },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: spacing.md },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  fieldLabel: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.xs },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  itemNombre: { color: colors.text, fontSize: 14, fontWeight: '600' },
  itemSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  stockInput: { width: 64, backgroundColor: colors.bg, color: colors.text, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, textAlign: 'center', paddingVertical: spacing.xs, minHeight: 38 },
  stockBoton: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  stockBotonTexto: { color: '#0F172A', fontSize: 18, fontWeight: '800', lineHeight: 20 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  colorChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  colorChipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  colorChipTexto: { color: colors.textMuted, fontSize: 12 },
  colorChipTextoActivo: { color: colors.bg, fontWeight: '700' },
  colorHint: { color: colors.textMuted, fontSize: 11 },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  preview: { color: colors.primary, fontSize: 12, marginTop: spacing.xs },
  button: { backgroundColor: colors.success, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  buttonText: { color: '#0F172A', fontWeight: '700' },
});

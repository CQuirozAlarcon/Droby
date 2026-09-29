import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { colors, radius, spacing, MODELOS_IPHONE, COLORES_UNIVERSALES, COLOR_SIN_VARIANTE } from '@/lib/theme';
import { useInventario } from '@/hooks/useInventario';
import { useAuth } from '@/hooks/useAuth';
import { SoloAdmin } from '@/components/SoloAdmin';
import { showAlert } from '@/lib/alert';
import { Producto } from '@/types/database';

// ---------------------------------------------------------------------------
// MOTOR DE INVENTARIO — Vista MATRICIAL de cases (solo admin).
//
// Cruza Modelos × Colores para ingresar mercancía masiva: cada celda muestra
// el stock actual y un input con la cantidad a AGREGAR (entrada). Si la
// combinación modelo+color no existe todavía, se crea automáticamente con
// el precio y costo definidos arriba (los cases usan la paleta universal).
// ---------------------------------------------------------------------------

const NOTA_ENTRADA = 'Entrada masiva — vista matricial de cases';

export default function InventarioMatricialScreen() {
  const { rol } = useAuth();
  const { productos, ajustarStock, crearProducto } = useInventario();

  const [entradas, setEntradas] = useState<Record<string, string>>({});
  const [precioNuevo, setPrecioNuevo] = useState('');
  const [costoNuevo, setCostoNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const fundas = useMemo(() => productos.filter((p) => p.tipo === 'funda'), [productos]);

  // modelo → color → producto (variante NULL = "Sin color")
  const porModelo = useMemo(() => {
    const map = new Map<string, Map<string, Producto>>();
    fundas.forEach((p) => {
      const color = p.variante ?? COLOR_SIN_VARIANTE;
      if (!map.has(p.modelo)) map.set(p.modelo, new Map());
      map.get(p.modelo)!.set(color, p);
    });
    return map;
  }, [fundas]);

  // Filas: catálogo maestro de modelos + cualquier modelo ya cargado en la BD.
  const modelos = useMemo(() => {
    const extra = [...porModelo.keys()].filter((m) => !MODELOS_IPHONE.includes(m));
    return [...MODELOS_IPHONE, ...extra];
  }, [porModelo]);

  // Columnas: paleta universal + "Sin color" si hay fundas cargadas sin variante.
  const colores = useMemo(() => {
    const base = COLORES_UNIVERSALES.map((c) => c.nombre);
    const haySinColor = fundas.some((p) => !p.variante);
    if (haySinColor) base.push(COLOR_SIN_VARIANTE);
    return base;
  }, [fundas]);

  const celdasLlenas = Object.values(entradas).filter((v) => parseInt(v || '0', 10) > 0).length;

  function setEntrada(modelo: string, color: string, valor: string) {
    const key = `${modelo}|${color}`;
    setEntradas((prev) => ({ ...prev, [key]: valor.replace(/[^0-9]/g, '') }));
  }

  async function guardar() {
    const pendientes = Object.entries(entradas).filter(([, v]) => parseInt(v || '0', 10) > 0);
    if (pendientes.length === 0) {
      showAlert('Nada para guardar', 'Escribe al menos una cantidad en la matriz');
      return;
    }

    const creaCombinacionesNuevas = pendientes.some(([key]) => {
      const [modelo, color] = key.split('|');
      return !porModelo.get(modelo)?.get(color);
    });
    const precioNum = parseFloat(precioNuevo);
    const costoNum = parseFloat(costoNuevo);
    if (creaCombinacionesNuevas && (!precioNum || !costoNum)) {
      showAlert('Faltan datos', 'Para crear combinaciones nuevas define el precio y costo de las fundas nuevas');
      return;
    }

    setGuardando(true);
    try {
      for (const [key, valor] of pendientes) {
        const [modelo, color] = key.split('|');
        const cantidad = parseInt(valor, 10);
        const producto = porModelo.get(modelo)?.get(color);
        if (producto) {
          await ajustarStock(producto.id, cantidad, NOTA_ENTRADA);
        } else {
          await crearProducto({
            tipo: 'funda',
            modelo,
            variante: color === COLOR_SIN_VARIANTE ? null : color,
            stock_actual: cantidad,
            precio_unitario: precioNum,
            costo_unitario: costoNum,
          });
        }
      }
      setEntradas({});
      showAlert('Inventario actualizado', `${pendientes.length} celda(s) de la matriz procesada(s)`);
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (rol !== 'admin') return <SoloAdmin />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Ingresa la cantidad de unidades que ENTRAN por cada combinación modelo × color. Las celdas vacías no se
        tocan; las combinaciones nuevas se crean con el precio y costo de abajo.
      </Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Precio fundas nuevas (S/)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={precioNuevo} onChangeText={setPrecioNuevo} placeholder="Ej. 10" placeholderTextColor={colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Costo fundas nuevas (S/)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={costoNuevo} onChangeText={setCostoNuevo} placeholder="Ej. 5" placeholderTextColor={colors.textMuted} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
        <View>
          <View style={styles.fila}>
            <Text style={[styles.celda, styles.celdaModeloHeader]}>Modelo</Text>
            {colores.map((color) => (
              <Text key={color} style={[styles.celda, styles.celdaColorHeader]} numberOfLines={1}>
                {color}
              </Text>
            ))}
          </View>
          {modelos.map((modelo) => (
            <View key={modelo} style={styles.fila}>
              <Text style={[styles.celda, styles.celdaModelo]} numberOfLines={1}>
                {modelo}
              </Text>
              {colores.map((color) => {
                const producto = porModelo.get(modelo)?.get(color);
                const key = `${modelo}|${color}`;
                return (
                  <View key={key} style={[styles.celda, styles.celdaMatriz, !producto && styles.celdaMatrizNueva]}>
                    <Text style={styles.stockActual} accessibilityLabel={`Stock actual de ${modelo} color ${color}: ${producto?.stock_actual ?? 0}`}>
                      {producto ? producto.stock_actual : '—'}
                    </Text>
                    <TextInput
                      style={styles.matrizInput}
                      keyboardType="numeric"
                      placeholder="+0"
                      placeholderTextColor={colors.textMuted}
                      value={entradas[key] ?? ''}
                      onChangeText={(t) => setEntrada(modelo, color, t)}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      accessibilityLabel={`Entrada de stock para ${modelo} color ${color}`}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.hintSmall}>"—" = combinación sin crear aún. La columna "Sin color" agrupa fundas cargadas sin variante.</Text>

      <Pressable style={styles.button} onPress={guardar} disabled={guardando} accessibilityRole="button" accessibilityLabel="Guardar entradas masivas">
        <Text style={styles.buttonText}>{guardando ? 'Guardando...' : `Guardar entradas (${celdasLlenas})`}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xs },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  hintSmall: { color: colors.textMuted, fontSize: 11, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  fieldLabel: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  fila: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  celda: { width: 76, paddingVertical: spacing.xs, paddingHorizontal: spacing.xs, alignItems: 'center' },
  celdaModelo: { width: 130, alignItems: 'flex-start', color: colors.text, fontSize: 12, fontWeight: '600' },
  celdaModeloHeader: { width: 130, alignItems: 'flex-start', color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  celdaColorHeader: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  celdaMatriz: { backgroundColor: colors.surface, borderRadius: radius.sm, margin: 2, padding: 4 },
  celdaMatrizNueva: { backgroundColor: 'rgba(129, 140, 248, 0.08)' },
  stockActual: { color: colors.textMuted, fontSize: 10 },
  matrizInput: { backgroundColor: colors.bg, color: colors.text, borderRadius: 6, borderWidth: 1, borderColor: colors.border, width: '100%', textAlign: 'center', paddingVertical: 2, paddingHorizontal: 4, fontSize: 13, fontWeight: '600', minHeight: 30 },
  button: { backgroundColor: colors.success, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  buttonText: { color: '#0F172A', fontWeight: '700' },
});

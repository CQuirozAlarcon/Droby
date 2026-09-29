import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { colors, radius, spacing, COLORES_UNIVERSALES, COLOR_SIN_VARIANTE, hexColor } from '@/lib/theme';
import { Producto } from '@/types/database';
import { showAlert } from '@/lib/alert';

// ---------------------------------------------------------------------------
// Paleta de CASES (fundas) para el punto de venta.
//
// Cada producto de tipo "funda" es una celda (modelo × color): `variante`
// guarda el color. La paleta de colores es universal y compartida entre
// todos los modelos, así que la UI son dos modos:
//
//   • AGRUPADO: se marcan varios modelos, un único campo maestro "Aplicar a
//     todos" asigna la misma cantidad a TODOS los colores de TODOS los
//     modelos marcados (el pedido se multiplica internamente por modelo).
//
//   • POR MODELO: pestañas horizontales; cada modelo muestra su cuadrícula
//     de colores con cantidades exactas. Las cantidades viven en el estado
//     del padre (seleccion), por lo que cambiar de pestaña NO pierde lo ya
//     ingresado (persistencia entre pestañas).
// ---------------------------------------------------------------------------

type ModoCases = 'agrupado' | 'modelo';

interface Props {
  fundas: Producto[];
  seleccion: Record<number, number>;
  onSetCantidad: (productoId: number, cantidad: number) => void;
}

interface CeldaProps {
  hex: string;
  nombre: string;
  stock: number;
  valor: number;
  deshabilitada?: boolean;
  excedeIndividual?: boolean;
  onChange: (texto: string) => void;
}

// Celda individual de la cuadrícula de colores: swatch + nombre + stock +
// input numérico. Se pinta ROJO al instante si la cantidad supera el stock.
function CeldaColor({ hex, nombre, stock, valor, deshabilitada, excedeIndividual, onChange }: CeldaProps) {
  const excede = valor > stock || Boolean(excedeIndividual);
  return (
    <View style={[styles.celda, deshabilitada && styles.celdaDeshabilitada, excede && !deshabilitada && styles.celdaExcede]}>
      <View style={styles.celdaHeader}>
        <View style={[styles.swatch, { backgroundColor: hex }]} />
        <Text style={[styles.celdaNombre, deshabilitada && { color: colors.textMuted }]} numberOfLines={1}>
          {nombre}
        </Text>
      </View>
      <Text style={[styles.celdaStock, excede && { color: colors.danger }]} accessibilityLabel={`Stock de ${nombre}: ${stock}`}>
        stock: {deshabilitada ? '—' : stock}
      </Text>
      {deshabilitada ? (
        <View style={styles.celdaInputVacio}>
          <Text style={styles.celdaInputVacioTexto}>—</Text>
        </View>
      ) : (
        <TextInput
          style={[styles.celdaInput, excede && styles.celdaInputExcede]}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          value={valor > 0 ? String(valor) : ''}
          onChangeText={onChange}
          returnKeyType="next"
          blurOnSubmit={false}
          accessibilityLabel={`Cantidad de fundas color ${nombre}`}
        />
      )}
    </View>
  );
}

export function CasesPalette({ fundas, seleccion, onSetCantidad }: Props) {
  const [modo, setModo] = useState<ModoCases>('agrupado');
  const [modelosSeleccionados, setModelosSeleccionados] = useState<string[]>([]);
  const [modeloActivo, setModeloActivo] = useState<string | null>(null);
  const [valorMaestro, setValorMaestro] = useState('');

  // modelo → color → producto
  const porModelo = useMemo(() => {
    const map = new Map<string, Map<string, Producto>>();
    fundas.forEach((p) => {
      const color = p.variante ?? COLOR_SIN_VARIANTE;
      if (!map.has(p.modelo)) map.set(p.modelo, new Map());
      map.get(p.modelo)!.set(color, p);
    });
    return map;
  }, [fundas]);

  const modelos = useMemo(() => [...porModelo.keys()], [porModelo]);
  const modeloVigente = modeloActivo && porModelo.has(modeloActivo) ? modeloActivo : modelos[0] ?? null;

  // Colores a mostrar en la cuadrícula: paleta universal + "Sin color" si
  // algún modelo en alcance tiene fundas cargadas sin variante.
  const colores = useMemo(() => {
    const base = COLORES_UNIVERSALES.map((c) => c.nombre);
    const enScope =
      modo === 'agrupado'
        ? modelosSeleccionados.flatMap((m) => [...(porModelo.get(m)?.keys() ?? [])])
        : [...(porModelo.get(modeloVigente ?? '')?.keys() ?? [])];
    if (enScope.includes(COLOR_SIN_VARIANTE)) base.push(COLOR_SIN_VARIANTE);
    return base;
  }, [modo, modelosSeleccionados, modeloVigente, porModelo]);

  function parseCantidad(texto: string): number {
    const soloDigitos = texto.replace(/[^0-9]/g, '');
    return soloDigitos ? parseInt(soloDigitos, 10) : 0;
  }

  function toggleModelo(modelo: string) {
    setModelosSeleccionados((prev) => (prev.includes(modelo) ? prev.filter((m) => m !== modelo) : [...prev, modelo]));
  }

  // Campo maestro: "5" → 5 unidades de TODOS los colores de TODOS los
  // modelos marcados (multiplicación interna por cada modelo seleccionado).
  function aplicarATodos() {
    const n = parseCantidad(valorMaestro);
    if (modelosSeleccionados.length === 0) {
      showAlert('Sin modelos', 'Marca al menos un modelo antes de aplicar');
      return;
    }
    if (n <= 0) {
      showAlert('Cantidad inválida', 'Escribe un número mayor a 0 en "Aplicar a todos"');
      return;
    }
    modelosSeleccionados.forEach((modelo) => {
      porModelo.get(modelo)?.forEach((producto) => onSetCantidad(producto.id, n));
    });
    showAlert(
      'Plantilla aplicada',
      `${n} unidades por color en ${modelosSeleccionados.length} modelo(s) marcado(s)`
    );
  }

  // En modo AGRUPADO cada color puede tener un producto por modelo marcado:
  // la celda opera sobre todos a la vez.
  function celdaAgrupada(color: string) {
    const productos = modelosSeleccionados
      .map((m) => porModelo.get(m)?.get(color))
      .filter((p): p is Producto => Boolean(p));
    const stockTotal = productos.reduce((acc, p) => acc + p.stock_actual, 0);
    const valores = productos.map((p) => seleccion[p.id] ?? 0);
    const valorComun = valores.length > 0 && valores.every((v) => v === valores[0]) ? valores[0] : 0;
    const excede = productos.some((p) => (valorComun) > p.stock_actual);
    return { productos, stockTotal, valorComun, excede };
  }

  const totalSeleccion = useMemo(
    () => Object.entries(seleccion).reduce((acc, [, cant]) => acc + cant, 0),
    [seleccion]
  );

  function limpiarModelo(modelo: string) {
    porModelo.get(modelo)?.forEach((p) => onSetCantidad(p.id, 0));
  }

  if (modelos.length === 0) {
    return (
      <View style={styles.vacio}>
        <Text style={styles.vacioTexto}>
          No hay fundas cargadas en el catálogo. Cargalas desde Inventario → Cases (vista matricial).
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.modoRow}>
        <Pressable
          style={[styles.modoChip, modo === 'agrupado' && styles.modoChipActivo]}
          onPress={() => setModo('agrupado')}
          accessibilityRole="button"
          accessibilityLabel="Modo agrupado, lotes masivos"
          accessibilityState={{ selected: modo === 'agrupado' }}
        >
          <Text style={[styles.modoChipTexto, modo === 'agrupado' && styles.modoChipTextoActivo]}>
            📦 AGRUPADO (lotes)
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modoChip, modo === 'modelo' && styles.modoChipActivo]}
          onPress={() => setModo('modelo')}
          accessibilityRole="button"
          accessibilityLabel="Modo por modelo, pedidos específicos"
          accessibilityState={{ selected: modo === 'modelo' }}
        >
          <Text style={[styles.modoChipTexto, modo === 'modelo' && styles.modoChipTextoActivo]}>
            📱 POR MODELO
          </Text>
        </Pressable>
      </View>

      {modo === 'agrupado' ? (
        <>
          <Text style={styles.hint}>
            Marca varios modelos y usa el campo maestro: la cantidad se aplica a todos los colores y se
            multiplica por cada modelo marcado.
          </Text>

          <View style={styles.modelosWrap}>
            {modelos.map((modelo) => {
              const marcado = modelosSeleccionados.includes(modelo);
              return (
                <Pressable
                  key={modelo}
                  style={[styles.modeloChip, marcado && styles.modeloChipActivo]}
                  onPress={() => toggleModelo(modelo)}
                  accessibilityRole="button"
                  accessibilityLabel={`Modelo ${modelo}`}
                  accessibilityState={{ selected: marcado }}
                >
                  <Text style={[styles.modeloChipTexto, marcado && styles.modeloChipTextoActivo]}>
                    {marcado ? '✓ ' : ''}{modelo}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.maestroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.maestroLabel}>Aplicar a todos</Text>
              <TextInput
                style={styles.maestroInput}
                keyboardType="numeric"
                placeholder="Ej. 5"
                placeholderTextColor={colors.textMuted}
                value={valorMaestro}
                onChangeText={setValorMaestro}
                returnKeyType="next"
                blurOnSubmit={false}
                accessibilityLabel="Cantidad a aplicar a todos los colores de los modelos marcados"
              />
            </View>
            <Pressable style={styles.maestroBoton} onPress={aplicarATodos} accessibilityRole="button" accessibilityLabel="Aplicar cantidad a todos">
              <Text style={styles.maestroBotonTexto}>Aplicar a todos</Text>
            </Pressable>
          </View>

          {modelosSeleccionados.length > 0 ? (
            <>
              <Text style={styles.seccion}>
                Plantilla de colores — {modelosSeleccionados.length} modelo(s) marcado(s)
              </Text>
              <View style={styles.grid}>
                {colores.map((color) => {
                  const { productos, stockTotal, valorComun, excede } = celdaAgrupada(color);
                  return (
                    <CeldaColor
                      key={color}
                      hex={hexColor(color)}
                      nombre={color}
                      stock={stockTotal}
                      valor={valorComun}
                      deshabilitada={productos.length === 0}
                      excedeIndividual={excede}
                      onChange={(texto) => {
                        const n = parseCantidad(texto);
                        productos.forEach((p) => onSetCantidad(p.id, n));
                      }}
                    />
                  );
                })}
              </View>
              <View style={styles.resumenRow}>
                <Text style={styles.resumenTexto}>
                  {totalSeleccion} unidades en el pedido · {modelosSeleccionados.length * colores.length} combinaciones máx.
                </Text>
                <Pressable onPress={() => modelosSeleccionados.forEach((m) => limpiarModelo(m))} accessibilityRole="button" accessibilityLabel="Limpiar modelos marcados">
                  <Text style={styles.limpiarTexto}>Limpiar marcados</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.hint}>Marca arriba los modelos del lote para desplegar la plantilla de colores.</Text>
          )}
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            Navega entre modelos: las cantidades ingresadas en cada pestaña se conservan aunque cambies de modelo.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            {modelos.map((modelo) => {
              const activo = modelo === modeloVigente;
              const unidades = [...(porModelo.get(modelo)?.values() ?? [])].reduce(
                (acc, p) => acc + (seleccion[p.id] ?? 0),
                0
              );
              return (
                <Pressable
                  key={modelo}
                  style={[styles.tab, activo && styles.tabActivo]}
                  onPress={() => setModeloActivo(modelo)}
                  accessibilityRole="button"
                  accessibilityLabel={`Pestaña del modelo ${modelo}`}
                  accessibilityState={{ selected: activo }}
                >
                  <Text style={[styles.tabTexto, activo && styles.tabTextoActivo]}>{modelo}</Text>
                  {unidades > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeTexto}>{unidades}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {modeloVigente && (
            <>
              <View style={styles.grid}>
                {colores.map((color) => {
                  const producto = porModelo.get(modeloVigente)?.get(color);
                  return (
                    <CeldaColor
                      key={color}
                      hex={hexColor(color)}
                      nombre={color}
                      stock={producto?.stock_actual ?? 0}
                      valor={producto ? seleccion[producto.id] ?? 0 : 0}
                      deshabilitada={!producto}
                      onChange={(texto) => producto && onSetCantidad(producto.id, parseCantidad(texto))}
                    />
                  );
                })}
              </View>
              <Pressable onPress={() => limpiarModelo(modeloVigente)} accessibilityRole="button" accessibilityLabel={`Limpiar cantidades de ${modeloVigente}`}>
                <Text style={styles.limpiarTexto}>Limpiar {modeloVigente}</Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: spacing.sm },
  vacio: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  vacioTexto: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
  modoRow: { flexDirection: 'row', gap: spacing.sm },
  modoChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  modoChipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  modoChipTexto: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  modoChipTextoActivo: { color: colors.bg },
  hint: { color: colors.textMuted, fontSize: 12 },
  seccion: { color: colors.text, fontWeight: '700', fontSize: 13, marginTop: spacing.xs },
  modelosWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  modeloChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  modeloChipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeloChipTexto: { color: colors.textMuted, fontSize: 12 },
  modeloChipTextoActivo: { color: colors.bg, fontWeight: '700' },
  maestroRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  maestroLabel: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  maestroInput: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, minHeight: 46 },
  maestroBoton: { backgroundColor: colors.success, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 46, justifyContent: 'center' },
  maestroBotonTexto: { color: '#0F172A', fontWeight: '700', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  celda: { width: '30%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, flexGrow: 0 },
  celdaDeshabilitada: { opacity: 0.35 },
  celdaExcede: { borderColor: colors.danger },
  celdaHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
  celdaNombre: { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  celdaStock: { color: colors.textMuted, fontSize: 10, marginTop: 2, marginBottom: spacing.xs },
  celdaInput: { backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  celdaInputExcede: { borderColor: colors.danger, color: colors.danger },
  celdaInputVacio: { borderRadius: radius.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  celdaInputVacioTexto: { color: colors.textMuted },
  resumenRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumenTexto: { color: colors.textMuted, fontSize: 12, flex: 1 },
  limpiarTexto: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  tabsContent: { gap: spacing.sm, paddingVertical: spacing.xs },
  tab: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabTexto: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextoActivo: { color: colors.bg, fontWeight: '700' },
  tabBadge: { backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 5, minWidth: 16, alignItems: 'center' },
  tabBadgeTexto: { color: colors.primary, fontSize: 10, fontWeight: '800' },
});

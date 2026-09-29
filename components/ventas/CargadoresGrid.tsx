import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { Producto } from '@/types/database';

// ---------------------------------------------------------------------------
// Paleta de CARGADORES para el punto de venta (productos simples).
//
// Sin lógica de modelos ni colores: cada tarjeta es un objeto del catálogo
// (ej. id=001 · Samsung 65W · Negro · S/ 12.00) con su stock y un ingreso
// directo por botones +/− o campo numérico. Se marca ROJO al instante si
// la cantidad supera el stock disponible.
// ---------------------------------------------------------------------------

const MAX_TIPOS_CATALOGO = 15;

interface Props {
  cargadores: Producto[];
  seleccion: Record<number, number>;
  onSetCantidad: (productoId: number, cantidad: number) => void;
}

function parseCantidad(texto: string): number {
  const soloDigitos = texto.replace(/[^0-9]/g, '');
  return soloDigitos ? parseInt(soloDigitos, 10) : 0;
}

export function CargadoresGrid({ cargadores, seleccion, onSetCantidad }: Props) {
  if (cargadores.length === 0) {
    return (
      <View style={styles.vacio}>
        <Text style={styles.vacioTexto}>
          No hay cargadores cargados en el catálogo. Agregálos desde Inventario → Cargadores (vista de lista).
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.hint}>
        Catálogo de cargadores ({cargadores.length}/{MAX_TIPOS_CATALOGO} tipos) — ingresa la cantidad directa con +/− o el teclado.
      </Text>
      <FlatList
        data={cargadores.slice(0, MAX_TIPOS_CATALOGO)}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.columna}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const cantidad = seleccion[item.id] ?? 0;
          const excede = cantidad > item.stock_actual;
          const agotado = item.stock_actual === 0;
          return (
            <View style={[styles.card, agotado && styles.cardAgotado]}>
              <Text style={styles.cardTitulo} numberOfLines={1}>
                🔌 {item.modelo}
              </Text>
              <Text style={styles.cardSub}>
                {item.variante ?? 'Único color'} · S/ {item.precio_unitario.toFixed(2)}
              </Text>
              <Text style={[styles.cardStock, excede && { color: colors.danger }]} accessibilityLabel={`Stock de ${item.modelo}: ${item.stock_actual}`}>
                stock: {item.stock_actual}
              </Text>
              <View style={styles.stepperRow}>
                <Pressable
                  style={[styles.stepperBtn, (cantidad <= 0 || agotado) && styles.stepperBtnOff]}
                  onPress={() => onSetCantidad(item.id, Math.max(0, cantidad - 1))}
                  disabled={cantidad <= 0 || agotado}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar una unidad de ${item.modelo}`}
                >
                  <Text style={styles.stepperTexto}>−</Text>
                </Pressable>
                <TextInput
                  style={[styles.stepperInput, excede && styles.stepperInputExcede]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={cantidad > 0 ? String(cantidad) : ''}
                  onChangeText={(t) => onSetCantidad(item.id, parseCantidad(t))}
                  editable={!agotado}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  accessibilityLabel={`Cantidad de ${item.modelo}${item.variante ? ` color ${item.variante}` : ''}`}
                />
                <Pressable
                  style={[styles.stepperBtn, (cantidad >= item.stock_actual || agotado) && styles.stepperBtnOff]}
                  onPress={() => onSetCantidad(item.id, Math.min(item.stock_actual, cantidad + 1))}
                  disabled={cantidad >= item.stock_actual || agotado}
                  accessibilityRole="button"
                  accessibilityLabel={`Agregar una unidad de ${item.modelo}`}
                >
                  <Text style={styles.stepperTexto}>+</Text>
                </Pressable>
              </View>
              {agotado && <Text style={styles.agotadoTexto}>Agotado</Text>}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  vacio: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  vacioTexto: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
  columna: { gap: spacing.sm, marginBottom: spacing.sm },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardAgotado: { opacity: 0.5 },
  cardTitulo: { color: colors.text, fontWeight: '700', fontSize: 14 },
  cardSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  cardStock: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs, marginBottom: spacing.xs },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepperBtn: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  stepperBtnOff: { opacity: 0.35 },
  stepperTexto: { color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 22 },
  stepperInput: { flex: 1, backgroundColor: colors.bg, color: colors.text, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, textAlign: 'center', fontSize: 15, fontWeight: '700', paddingVertical: spacing.xs, minHeight: 38 },
  stepperInputExcede: { borderColor: colors.danger, color: colors.danger },
  agotadoTexto: { color: colors.danger, fontSize: 10, fontWeight: '700', marginTop: spacing.xs, textTransform: 'uppercase' },
});

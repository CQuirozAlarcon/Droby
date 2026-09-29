import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

export interface SelectOption<T extends string | number> {
  label: string;
  value: T;
}

interface SelectProps<T extends string | number> {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}

// Selector acoplado al tema oscuro de la app.
//
// Reemplaza a @react-native-picker/picker: el Picker de Android abre un
// diálogo BLANCO del sistema y (como los ítems llevaban color casi blanco)
// las opciones apenas se veían. Aquí la lista es un bottom sheet del mismo
// tema que el resto de pantallas: legible, táctil y accesible.
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = 'Seleccionar…',
  accessibilityLabel,
}: SelectProps<T>) {
  const [abierto, setAbierto] = useState(false);
  const seleccionada = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        style={styles.campo}
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel ?? placeholder}${seleccionada ? `: ${seleccionada.label}` : ''}`}
        accessibilityHint="Abre la lista de opciones"
      >
        <Text style={[styles.campoTexto, !seleccionada && { color: colors.textMuted }]} numberOfLines={1}>
          {seleccionada?.label ?? placeholder}
        </Text>
        <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          ▾
        </Text>
      </Pressable>

      <Modal visible={abierto} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setAbierto(false)}>
        {/* sin accessibilityRole: en web, los Pressable anidados con role="button"
            se renderizan como <button> dentro de <button> (HTML inválido) y
            rompen la hidratación. El backdrop solo captura el tap para cerrar;
            accesibilidadElementsHidden evita que el lector de pantalla lo
            anuncie como un botón extra. */}
        <Pressable
          style={styles.backdrop}
          onPress={() => setAbierto(false)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* stopPropagation: tocar la hoja no cierra, solo el fondo */}
          <Pressable
            style={styles.hoja}
            onPress={(e) => e.stopPropagation()}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            accessibilityViewIsModal
          >
            <View style={styles.hojaHandle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              style={styles.lista}
              renderItem={({ item }) => {
                const activo = item.value === value;
                return (
                  <Pressable
                    style={[styles.opcion, activo && styles.opcionActiva]}
                    onPress={() => {
                      onChange(item.value);
                      setAbierto(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: activo }}
                  >
                    <Text style={[styles.opcionTexto, activo && styles.opcionTextoActivo]}>{item.label}</Text>
                    {activo && (
                      <Text style={styles.check} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        ✓
                      </Text>
                    )}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    gap: spacing.sm,
  },
  campoTexto: { color: colors.text, fontSize: 14, flex: 1 },
  chevron: { color: colors.textMuted, fontSize: 14 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  hoja: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    maxHeight: '70%',
  },
  hojaHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  lista: { flexGrow: 0 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  opcionActiva: { backgroundColor: colors.surfaceAlt },
  opcionTexto: { color: colors.text, fontSize: 15, flex: 1 },
  opcionTextoActivo: { color: colors.primary, fontWeight: '700' },
  check: { color: colors.primary, fontWeight: '800', fontSize: 15 },
});

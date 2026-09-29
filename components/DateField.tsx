import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius, spacing } from '@/lib/theme';
import { fechaLocalISO } from '@/lib/fecha';

interface DateFieldProps {
  value: Date | null;
  onChange: (fecha: Date | null) => void;
  placeholder?: string;
  /** Fecha mínima seleccionable (ej. hoy, para vencimientos futuros) */
  minimumDate?: Date;
  accessibilityLabel?: string;
  /** Permite dejar el campo vacío con una ✕ (para fechas opcionales) */
  limpiable?: boolean;
}

function formatear(d: Date): string {
  return fechaLocalISO(d).split('-').reverse().join('/'); // DD/MM/YYYY
}

// Campo de fecha acoplado al tema: se ve como un input más de la app y al
// tocarlo abre el DatePicker nativo (antes se pedía escribir "YYYY-MM-DD" a
// mano en un TextInput, propenso a errores de formato).
//
// Android usa el diálogo nativo (DateTimePickerAndroid.open). iOS no tiene
// diálogo: se envuelve el spinner en un modal oscuro con botón "Listo".
export function DateField({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  minimumDate,
  accessibilityLabel,
  limpiable = false,
}: DateFieldProps) {
  const [mostrandoIOS, setMostrandoIOS] = useState(false);
  const [temporalIOS, setTemporalIOS] = useState<Date>(value ?? new Date());

  function abrir() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: value ?? new Date(),
        mode: 'date',
        minimumDate,
        onChange: (evento: DateTimePickerEvent, fecha?: Date) => {
          if (evento.type === 'set' && fecha) onChange(fecha);
        },
      });
    } else {
      setTemporalIOS(value ?? new Date());
      setMostrandoIOS(true);
    }
  }

  return (
    <>
      <View style={styles.fila}>
        <Pressable
          style={[styles.campo, { flex: 1 }]}
          onPress={abrir}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel ?? placeholder}${value ? `: ${formatear(value)}` : ''}`}
          accessibilityHint="Abre el selector de fecha"
        >
          <Text style={[styles.campoTexto, !value && { color: colors.textMuted }]}>
            {value ? formatear(value) : placeholder}
          </Text>
          <Text style={styles.icono} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            📅
          </Text>
        </Pressable>
        {limpiable && value !== null && (
          <Pressable
            style={styles.limpiar}
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel="Quitar la fecha"
            hitSlop={8}
          >
            <Text style={styles.limpiarTexto}>✕</Text>
          </Pressable>
        )}
      </View>

      {Platform.OS === 'ios' && (
        <Modal visible={mostrandoIOS} transparent animationType="slide" onRequestClose={() => setMostrandoIOS(false)}>
          <View style={styles.iosOverlay}>
            <View style={styles.iosHoja}>
              <DateTimePicker
                value={temporalIOS}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                themeVariant="dark"
                onChange={(_, fecha) => {
                  if (fecha) setTemporalIOS(fecha);
                }}
              />
              <Pressable
                style={styles.iosListo}
                onPress={() => {
                  onChange(temporalIOS);
                  setMostrandoIOS(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Confirmar fecha"
              >
                <Text style={styles.iosListoTexto}>Listo</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  },
  campoTexto: { color: colors.text, fontSize: 14 },
  icono: { fontSize: 16 },
  limpiar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limpiarTexto: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  iosOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.72)', justifyContent: 'flex-end' },
  iosHoja: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  iosListo: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  iosListoTexto: { color: colors.bg, fontWeight: '800' },
});

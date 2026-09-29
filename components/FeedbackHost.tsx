import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { _subscribeFeedback, ConfirmPayload, ToastKind, ToastPayload } from '@/lib/alert';

const DURACION_TOAST_MS = 3600;

const TOAST_COLOR: Record<ToastKind, string> = {
  success: colors.success,
  error: colors.danger,
  info: colors.primary,
};

const TOAST_ICONO: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

// Renderiza los avisos emitidos por showAlert()/showConfirm() (lib/alert).
// Se monta UNA sola vez en app/_layout.tsx, debajo del Stack.
//
// El toast usa su propio <Modal transparent> para que también se vea cuando
// hay otro modal abierto (ej. los formularios de Finanzas): un View absoluto
// en la raíz quedaría tapado por los modales nativos de Android.
// Se cierra solo a los ~3.6s o tocándolo.
export function FeedbackHost() {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const [confirm, setConfirm] = useState<ConfirmPayload | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const desuscribir = _subscribeFeedback((evento) => {
      if (evento.type === 'toast') mostrarToast(evento.payload);
      else setConfirm(evento.payload);
    });
    return () => {
      desuscribir();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mostrarToast(payload: ToastPayload) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(payload);
    anim.stopAnimation();
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timerRef.current = setTimeout(ocultarToast, DURACION_TOAST_MS);
  }

  function ocultarToast() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setToast(null));
  }

  function handleConfirmar() {
    const accion = confirm?.onConfirm;
    setConfirm(null);
    accion?.();
  }

  const colorAcento = toast ? TOAST_COLOR[toast.kind] : colors.primary;

  return (
    <>
      {/* Toast: aviso pequeño que se desvanece solo */}
      <Modal visible={toast !== null} transparent animationType="none" statusBarTranslucent onRequestClose={ocultarToast}>
        <View style={styles.toastOverlay} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.toast,
              { borderLeftColor: colorAcento },
              {
                opacity: anim,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
              },
            ]}
          >
            <Pressable
              onPress={ocultarToast}
              style={styles.toastContenido}
              accessibilityRole="alert"
              accessibilityLabel={toast ? `${toast.title}${toast.message ? `. ${toast.message}` : ''}` : undefined}
            >
              <View style={[styles.toastIcono, { backgroundColor: colorAcento }]}>
                <Text style={styles.toastIconoTexto} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {toast ? TOAST_ICONO[toast.kind] : ''}
                </Text>
              </View>
              <View style={styles.toastTextos}>
                <Text style={styles.toastTitulo}>{toast?.title}</Text>
                {toast?.message ? <Text style={styles.toastMensaje}>{toast.message}</Text> : null}
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Confirmación: modal oscuro acoplado al tema (reemplaza el Alert blanco) */}
      <Modal visible={confirm !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setConfirm(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard} accessibilityViewIsModal>
            <Text style={styles.confirmTitulo}>{confirm?.title}</Text>
            <Text style={styles.confirmMensaje}>{confirm?.message}</Text>
            <View style={styles.confirmBotones}>
              <Pressable
                style={[styles.confirmBoton, styles.confirmBotonCancelar]}
                onPress={() => setConfirm(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
              >
                <Text style={styles.confirmCancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBoton, styles.confirmBotonAceptar]}
                onPress={handleConfirmar}
                accessibilityRole="button"
                accessibilityLabel={confirm?.confirmLabel ?? 'Confirmar'}
              >
                <Text style={styles.confirmAceptarTexto}>{confirm?.confirmLabel ?? 'Confirmar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toastOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: 56,
  },
  toast: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toastContenido: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  toastIcono: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastIconoTexto: { color: colors.bg, fontWeight: '800', fontSize: 13 },
  toastTextos: { flex: 1 },
  toastTitulo: { color: colors.text, fontWeight: '700', fontSize: 14 },
  toastMensaje: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  confirmTitulo: { color: colors.text, fontWeight: '800', fontSize: 17 },
  confirmMensaje: { color: colors.textMuted, fontSize: 14, marginTop: spacing.sm, lineHeight: 20 },
  confirmBotones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  confirmBoton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  confirmBotonCancelar: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  confirmCancelarTexto: { color: colors.text, fontWeight: '600' },
  confirmBotonAceptar: { backgroundColor: colors.danger },
  confirmAceptarTexto: { color: colors.bg, fontWeight: '800' },
});

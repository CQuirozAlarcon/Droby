// Sistema de avisos de la app.
//
// Antes esto llamaba a Alert.alert() nativo, que en Android abre un diálogo
// BLANCO del sistema: rompía el tema oscuro y el texto casi no se leía.
// Ahora showAlert/showConfirm solo emiten un evento y <FeedbackHost />
// (montado una sola vez en app/_layout.tsx) lo renderiza como un toast
// oscuro que se desvanece solo, o como un modal de confirmación acoplado
// al tema de la app.
//
// La API pública (showAlert / showConfirm) no cambió: todas las pantallas
// siguen llamándola igual.

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastPayload {
  kind: ToastKind;
  title: string;
  message?: string;
}

export interface ConfirmPayload {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export type FeedbackEvent =
  | { type: 'toast'; payload: ToastPayload }
  | { type: 'confirm'; payload: ConfirmPayload };

const listeners = new Set<(e: FeedbackEvent) => void>();

// Uso interno: solo lo llama <FeedbackHost />.
export function _subscribeFeedback(listener: (e: FeedbackEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(e: FeedbackEvent) {
  listeners.forEach((l) => l(e));
}

// Deduce el color del toast a partir del título, para no tener que tocar
// las ~40 llamadas existentes: "Error..." → rojo, "...registrada/generada"
// → verde, validaciones ("Falta...", "inválido...") → azul informativo.
function inferKind(title: string): ToastKind {
  const t = title.toLowerCase();
  if (t.includes('error')) return 'error';
  if (
    t.includes('registrad') || // registrada / registrado
    t.includes('generad') ||   // generada
    t.includes('pagad') ||     // pagada / pagado
    t.includes('listo') ||
    t.includes('éxito')
  ) {
    return 'success';
  }
  return 'info';
}

export function showAlert(title: string, message?: string) {
  emit({ type: 'toast', payload: { kind: inferKind(title), title, message } });
}

export function showConfirm(title: string, message: string, onConfirm: () => void, confirmLabel = 'Confirmar') {
  emit({ type: 'confirm', payload: { title, message, confirmLabel, onConfirm } });
}

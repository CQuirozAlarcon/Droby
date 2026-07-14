import { Alert, Platform } from 'react-native';

// Alert.alert de React Native no muestra nada en la versión web en muchos
// casos (queda en silencio). Esto hacía que errores reales (ej. de Supabase)
// pasaran desapercibidos y pareciera que un botón "no hace nada". Este helper
// usa window.alert en web (que sí es visible) y Alert.alert nativo en móvil.
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function showConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

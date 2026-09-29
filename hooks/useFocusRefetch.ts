import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

// Re-ejecuta `refetch` cada vez que la pantalla recupera el foco (menos la
// primera vez, porque el hook de datos ya hace su fetch inicial al montar).
// Sin esto, las listas de las tabs (que permanecen montadas) mostraban datos
// viejos tras crear/editar algo desde otra pantalla y volver.
export function useFocusRefetch(refetch: () => void | Promise<void>) {
  const primeraVez = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (primeraVez.current) {
        primeraVez.current = false;
        return;
      }
      refetch();
    }, [refetch])
  );
}

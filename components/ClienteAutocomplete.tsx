import { useEffect, useRef, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Cliente } from '@/types/database';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  onSelectCliente: (c: Cliente) => void;
  placeholder?: string;
}

// Autocompletado de clientes con búsqueda debounced en Supabase. Si el usuario
// escribe un nombre que no existe, se deja pasar tal cual (se crea al confirmar
// la venta/consignación), por eso no se fuerza selección de la lista.
export function ClienteAutocomplete({ value, onChangeText, onSelectCliente, placeholder }: Props) {
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [mostrarLista, setMostrarLista] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // guarda de orden: si la búsqueda vieja responde después que la nueva
  // (red lenta), sus resultados stale no pisan a los frescos
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // se quitan los comodines de LIKE para que un "%" o "_" tecleado por el
    // usuario no actúe como patrón SQL (ej. "%" listaba TODOS los clientes)
    const termino = value.trim().replace(/[%_]/g, '');
    if (!termino) {
      setResultados([]);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .ilike('nombre', `%${termino}%`)
        .limit(6);
      if (error) {
        console.warn('Error buscando clientes:', error.message);
        return;
      }
      if (requestId === requestIdRef.current) setResultados((data as Cliente[]) ?? []);
    }, 300);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value]);

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder={placeholder ?? 'Nombre del cliente'}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={placeholder ?? 'Nombre del cliente'}
        accessibilityHint="Escribe para buscar clientes existentes o ingresa uno nuevo"
        value={value}
        onChangeText={(t) => {
          onChangeText(t);
          setMostrarLista(true);
        }}
        onFocus={() => setMostrarLista(true)}
      />
      {mostrarLista && resultados.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={resultados}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                style={styles.item}
                onPress={() => {
                  onSelectCliente(item);
                  onChangeText(item.nombre);
                  setMostrarLista(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemText}>{item.nombre}</Text>
                  <Text style={styles.itemSub}>
                    {item.tipo_cliente}
                    {item.documento ? ` · ${item.documento}` : ''}
                    {item.telefono ? ` · ${item.telefono}` : ''}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdown: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 180,
  },
  item: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemText: { color: colors.text, fontSize: 14 },
  itemSub: { color: colors.textMuted, fontSize: 11, textTransform: 'capitalize' },
});

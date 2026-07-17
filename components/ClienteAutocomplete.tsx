import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Cliente } from '@/types/database';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (cliente: Cliente) => void;
}

export function ClienteAutocomplete({ value, onChangeText, onSelect }: Props) {
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [mostrar, setMostrar] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) {
      setResultados([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .ilike('nombre', `%${value.trim()}%`)
        .order('nombre')
        .limit(8);
      setResultados((data as Cliente[]) ?? []);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder="Nombre del cliente"
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={(t) => {
          onChangeText(t);
          setMostrar(true);
        }}
        onFocus={() => setMostrar(true)}
      />
      {mostrar && resultados.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={resultados}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.option}
                onPress={() => {
                  onSelect(item);
                  onChangeText(item.nombre);
                  setMostrar(false);
                  setResultados([]);
                }}
              >
                <Text style={styles.optionText}>{item.nombre}</Text>
                <Text style={styles.optionSub}>
                  {item.tipo_cliente}{item.telefono ? ` · ${item.telefono}` : ''}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  dropdown: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.xs, maxHeight: 220, overflow: 'hidden' },
  option: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  optionSub: { color: colors.textMuted, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
});
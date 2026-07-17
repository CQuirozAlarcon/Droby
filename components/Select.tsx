import { useState, useMemo } from 'react';
import { View, Text, Pressable, Modal, FlatList, TextInput, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

export interface SelectOption<T extends string | number = string> {
  label: string;
  value: T;
  subtitle?: string;
}

interface Props<T extends string | number> {
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  searchable?: boolean;
  emptyMessage?: string;
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = 'Seleccionar...',
  searchable = false,
  emptyMessage = 'Sin opciones',
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const seleccionado = options.find((o) => o.value === value);

  const filtradas = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={[styles.triggerText, !seleccionado && { color: colors.textMuted }]} numberOfLines={1}>
          {seleccionado ? seleccionado.label : placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {searchable && (
              <TextInput
                style={styles.search}
                placeholder="Buscar..."
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
            )}
            <FlatList
              data={filtradas}
              keyExtractor={(item) => String(item.value)}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.option, item.value === value && styles.optionActive]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionText, item.value === value && styles.optionTextActive]}>{item.label}</Text>
                    {item.subtitle ? <Text style={styles.optionSubtitle}>{item.subtitle}</Text> : null}
                  </View>
                  {item.value === value && <Text style={styles.check}>✓</Text>}
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  triggerText: { color: colors.text, fontSize: 14, flex: 1, marginRight: spacing.sm },
  chevron: { color: colors.textMuted, fontSize: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.md, maxHeight: '70%', borderTopWidth: 1, borderColor: colors.border,
  },
  search: {
    backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  optionActive: { backgroundColor: colors.surfaceAlt },
  optionText: { color: colors.text, fontSize: 14 },
  optionTextActive: { color: colors.primary, fontWeight: '700' },
  optionSubtitle: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  check: { color: colors.primary, fontWeight: '700', marginLeft: spacing.sm },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
});
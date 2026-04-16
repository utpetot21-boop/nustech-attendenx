/**
 * FilterChips — horizontal scrollable filter chips yang konsisten.
 * Menggantikan 4+ implementasi inline tiap screen dengan API yang sama.
 */
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { B, R } from '@/constants/tokens';

type Option = {
  label: string;
  value: string | undefined;
};

type Props = {
  options:      Option[];
  value:        string | undefined;
  onChange:     (v: string | undefined) => void;
  accentColor?: string;
  isDark?:      boolean;
};

export function FilterChips({
  options,
  value,
  onChange,
  accentColor = '#007AFF',
  isDark = false,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={String(opt.value ?? '__all')}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.75}
            style={[
              styles.chip,
              {
                backgroundColor: active
                  ? accentColor
                  : isDark ? 'rgba(255,255,255,0.09)' : '#FFFFFF',
                borderColor: active
                  ? accentColor
                  : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(60,60,67,0.18)',
              },
            ]}
          >
            <Text style={[
              styles.label,
              {
                color:      active ? '#FFF' : isDark ? 'rgba(255,255,255,0.75)' : '#475569',
                fontWeight: active ? '700' : '500',
              },
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical:   10,
    gap:               8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical:    8,
    borderRadius:      R.pill,
    borderWidth:       B.default,
  },
  label: {
    fontSize:      13,
    letterSpacing: 0,
  },
});

/**
 * StatusBadge — komponen universal untuk status badge di seluruh app.
 * Menggantikan 4+ implementasi inline yang tersebar di tiap screen.
 */
import { View, Text, StyleSheet } from 'react-native';
import { R, B } from '@/constants/tokens';

type Props = {
  label:   string;
  color:   string;   // hex, misal '#34C759'
  dot?:    boolean;  // tampilkan dot bulat di kiri (untuk status ongoing/active)
  size?:   'sm' | 'md'; // sm = chip kecil (default), md = sedikit lebih besar
};

export function StatusBadge({ label, color, dot = false, size = 'sm' }: Props) {
  const isMd = size === 'md';
  return (
    <View style={[
      styles.wrap,
      {
        backgroundColor: color + '1A',
        borderColor:     color + '33',
        paddingHorizontal: isMd ? 12 : 10,
        paddingVertical:   isMd ? 5  : 4,
      },
    ]}>
      {dot && (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text style={[
        styles.label,
        { color, fontSize: isMd ? 13 : 12 },
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    borderRadius:   R.pill,
    borderWidth:    B.default,
    alignSelf:      'flex-start',
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0,
  },
});

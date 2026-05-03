/**
 * EmptyState — tampilan kosong konsisten untuk seluruh screen.
 * Menggantikan 4+ implementasi inline yang masing-masing punya ukuran dan layout berbeda.
 */
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import React from 'react';
import { R, T, lPrimary, lSecondary } from '@/constants/tokens';

type IconComponent = React.ComponentType<{
  size?:        number;
  color?:       string;
  strokeWidth?: number;
}>;

type Props = {
  icon:       IconComponent;
  iconColor?: string;
  title:      string;
  message?:   string;
};

export function EmptyState({ icon: Icon, iconColor = '#9CA3AF', title, message }: Props) {
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconBox, { backgroundColor: iconColor + '18' }]}>
        <Icon size={32} color={iconColor} strokeWidth={1.5} />
      </View>
      <Text style={[styles.title, { color: lPrimary(isDark) }]}>
        {title}
      </Text>
      {message && (
        <Text style={[styles.message, { color: lSecondary(isDark) }]}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical:   32,
    paddingHorizontal: 32,
  },
  iconBox: {
    width: 72, height: 72,
    borderRadius:   R.xl,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   16,
  },
  title: {
    ...T.headline,
    fontWeight:  '700',
    textAlign:   'center',
    marginBottom: 8,
  },
  message: {
    ...T.subhead,
    textAlign:  'center',
    lineHeight: 22,
  },
});

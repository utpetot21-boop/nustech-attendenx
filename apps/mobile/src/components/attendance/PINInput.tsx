import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  Animated,
} from 'react-native';

interface Props {
  onComplete: (pin: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

export function PINInput({ onComplete, onCancel, isLoading, error }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [pin, setPin] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      // H4: reset ke 0 sebelum animasi — cegah akumulasi offset saat error berulang
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -10, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
      setPin('');
    }
  }, [error, shake]);

  const handlePress = (digit: string) => {
    if (isLoading) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 6) {
      onComplete(newPin);
    }
  };

  const handleDelete = () => {
    if (isLoading) return;
    setPin((p) => p.slice(0, -1));
  };

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <View
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.85)',
        borderRadius: 20,
        borderWidth: 0.5,
        borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)',
        padding: 24,
        marginHorizontal: 10,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: isDark ? '#FFFFFF' : '#111111',
          textAlign: 'center',
          marginBottom: 4,
          letterSpacing: -0.3,
        }}
      >
        Masukkan PIN 6 Digit
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: isDark ? 'rgba(255,255,255,0.50)' : '#6B7280',
          textAlign: 'center',
          marginBottom: 20,
        }}
      >
        PIN absensi berbeda dari password login
      </Text>

      {/* Dots */}
      <Animated.View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 12,
          marginBottom: 20,
          transform: [{ translateX: shake }],
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: i < pin.length
                ? error ? '#FF453A' : '#007AFF'
                : isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
            }}
          />
        ))}
      </Animated.View>

      {/* Error message */}
      {error && (
        <Text
          style={{
            fontSize: 12,
            color: '#FF453A',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          {error}
        </Text>
      )}

      {/* Numpad */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {KEYS.map((key, i) => {
          if (key === '') return <View key={i} style={{ flex: 1, height: 52 }} />;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => key === '⌫' ? handleDelete() : handlePress(key)}
              disabled={isLoading}
              style={{
                flex: 1,
                height: 52,
                borderRadius: 14,
                backgroundColor: key === '⌫'
                  ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                  : isDark ? 'rgba(255,255,255,0.12)' : '#FFFFFF',
                borderWidth: 0.5,
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isLoading ? 0.5 : 1,
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: key === '⌫' ? 18 : 20,
                  fontWeight: key === '⌫' ? '400' : '500',
                  color: isDark ? '#FFFFFF' : '#111111',
                }}
              >
                {key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Batal */}
      <TouchableOpacity onPress={onCancel} style={{ marginTop: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: '#007AFF' }}>Batal</Text>
      </TouchableOpacity>
    </View>
  );
}

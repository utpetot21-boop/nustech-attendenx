import { useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react-native';

import api from '@/services/api';
import { getCachedPushToken } from '@/services/notifications.service';
import { useAuthStore } from '@/stores/auth.store';
import { useQueryClient } from '@tanstack/react-query';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BANNER_HEIGHT = SCREEN_HEIGHT * 0.42;

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  require_password_change: boolean;
  user: {
    id: string;
    full_name: string;
    email: string;
    employee_id: string;
    role: { name: string };
    must_change_password: boolean;
  };
}

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Format email tidak valid';
    if (!password) e.password = 'Password wajib diisi';
    else if (password.length < 6) e.password = 'Password minimal 6 karakter';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const pushToken = await getCachedPushToken();
      const response = await api.post<LoginResponse>('/auth/login', {
        email: email.toLowerCase().trim(),
        password,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? '1.0.0',
        ...(pushToken ? { fcm_token: pushToken } : {}),
      });
      const { access_token, refresh_token, require_password_change } = response.data;
      await Promise.all([
        SecureStore.setItemAsync('access_token', access_token),
        SecureStore.setItemAsync('refresh_token', refresh_token),
        SecureStore.setItemAsync('user', JSON.stringify(response.data.user)),
      ]);
      setUser(response.data.user);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      if (require_password_change) {
        router.replace('/(auth)/change-password');
      } else {
        router.replace('/(main)');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: { error?: string } | string } } })
        ?.response?.data?.message;
      const errorText =
        typeof msg === 'object' && msg?.error
          ? msg.error
          : typeof msg === 'string'
          ? msg
          : 'Email atau password salah. Silakan coba lagi.';
      // P3-13: clear password setelah gagal (keamanan + UX)
      setPassword('');
      Alert.alert('Login Gagal', errorText, [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const inputBorder    = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const inputBg        = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const inputText      = isDark ? '#FFFFFF' : '#0F172A';
  const placeholderClr = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
  const labelColor     = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: isDark ? '#060612' : '#EEF2FF' }}
    >
      {/* ── HERO BANNER ─────────────────────────────────────────────────────── */}
      <View style={{ height: BANNER_HEIGHT, overflow: 'hidden' }}>
        <LinearGradient
          colors={
            isDark
              ? ['#060612', '#0D0B2E', '#1a1a60', '#2563EB', '#1D4ED8']
              : ['#1E3A8A', '#2563EB', '#3B82F6', '#60A5FA']
          }
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}
        >
          {/* Lingkaran dekoratif blur */}
          <View style={{
            position: 'absolute', top: -40, right: -40,
            width: 220, height: 220, borderRadius: 110,
            backgroundColor: 'rgba(255,255,255,0.06)',
          }} />
          <View style={{
            position: 'absolute', bottom: 20, left: -60,
            width: 180, height: 180, borderRadius: 90,
            backgroundColor: 'rgba(255,255,255,0.04)',
          }} />

          {/* Logo mark */}
          <View style={{
            width: 88, height: 88, borderRadius: 26,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.30)',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.30,
            shadowRadius: 24,
          }}>
            <ShieldCheck size={44} strokeWidth={1.6} color="#FFFFFF" />
          </View>

          <Text style={{
            fontSize: 34, fontWeight: '800',
            color: '#FFFFFF', letterSpacing: -1.2,
            textAlign: 'center',
          }}>
            AttendenX
          </Text>
          <Text style={{
            fontSize: 15, color: 'rgba(255,255,255,0.65)',
            marginTop: 8, textAlign: 'center', letterSpacing: 0.1,
          }}>
            Sistem Absensi & Monitoring Lapangan
          </Text>
        </LinearGradient>
      </View>

      {/* ── FORM — glass card overlap ke banner ─────────────────────────────── */}
      <View style={{ flex: 1, marginTop: -32, overflow: 'hidden' }}>
        <BlurView
          intensity={isDark ? 70 : 80}
          tint={isDark ? 'dark' : 'systemChromeMaterial'}
          style={{
            flex: 1,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            overflow: 'hidden',
            borderTopWidth: 0.5,
            borderLeftWidth: 0.5,
            borderRightWidth: 0.5,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)',
          }}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: 32,
              paddingHorizontal: 28,
              paddingBottom: insets.bottom + 40,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={{
              fontSize: 24, fontWeight: '700',
              color: isDark ? '#FFFFFF' : '#0F172A',
              letterSpacing: -0.6, marginBottom: 28,
            }}>
              Masuk ke Akun
            </Text>

            {/* ── Email ─────────────────────────────────────────── */}
            <View style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 9 }}>
                Email
              </Text>
              <View style={{ position: 'relative' }}>
                <View style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <Mail size={18} strokeWidth={1.8} color={errors.email ? '#FF3B30' : (isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.25)')} />
                </View>
                <TextInput
                  value={email}
                  onChangeText={(t) => { setEmail(t); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="email@perusahaan.id"
                  placeholderTextColor={placeholderClr}
                  style={{
                    height: 54,
                    borderRadius: 14,
                    paddingLeft: 48,
                    paddingRight: 18,
                    fontSize: 16,
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor: errors.email ? '#FF3B30' : inputBorder,
                    color: inputText,
                  }}
                />
              </View>
              {errors.email && (
                <Text style={{ fontSize: 13, color: '#FF3B30', marginTop: 6 }}>{errors.email}</Text>
              )}
            </View>

            {/* ── Password ──────────────────────────────────────── */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 9 }}>
                Password
              </Text>
              <View style={{ position: 'relative' }}>
                <View style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <Lock size={18} strokeWidth={1.8} color={errors.password ? '#FF3B30' : (isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.25)')} />
                </View>
                <TextInput
                  value={password}
                  onChangeText={(t) => { setPassword(t); if (errors.password) setErrors((e) => ({ ...e, password: undefined })); }}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  placeholder="Masukkan password"
                  placeholderTextColor={placeholderClr}
                  style={{
                    height: 54,
                    borderRadius: 14,
                    paddingLeft: 48,
                    paddingRight: 56,
                    fontSize: 16,
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor: errors.password ? '#FF3B30' : inputBorder,
                    color: inputText,
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}
                >
                  {showPassword
                    ? <EyeOff size={20} strokeWidth={1.8} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} />
                    : <Eye    size={20} strokeWidth={1.8} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} />
                  }
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={{ fontSize: 13, color: '#FF3B30', marginTop: 6 }}>{errors.password}</Text>
              )}
            </View>

            {/* ── Lupa password ─────────────────────────────────── */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              style={{ alignSelf: 'flex-end', marginBottom: 28, paddingVertical: 4 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#007AFF' }}>Lupa Password?</Text>
            </TouchableOpacity>

            {/* ── Tombol Login ──────────────────────────────────── */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.88}
              style={{
                height: 58,
                borderRadius: 16,
                backgroundColor: isLoading ? '#93C5FD' : '#007AFF',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#007AFF',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.40,
                shadowRadius: 20,
                elevation: 8,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
                  Masuk
                </Text>
              )}
            </TouchableOpacity>

            <Text style={{
              textAlign: 'center', fontSize: 13,
              color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
              marginTop: 32,
            }}>
              © 2025 Nustech · AttendenX v1.0
            </Text>
          </ScrollView>
        </BlurView>
      </View>
    </KeyboardAvoidingView>
  );
}

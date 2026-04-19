import { useRef, useState } from 'react';
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
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
} from 'lucide-react-native';

import api from '@/services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BANNER_HEIGHT = SCREEN_HEIGHT * 0.32;

type Step = 'identifier' | 'otp' | 'reset' | 'success';

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    identifier?: string;
    otp?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const otpRefs = useRef<Array<TextInput | null>>([]);

  // ── Theme colors ────────────────────────────────────────────────────────────
  const inputBorder    = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const inputBg        = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const inputText      = isDark ? '#FFFFFF' : '#0F172A';
  const placeholderClr = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
  const labelColor     = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';

  // ── Step 1: Kirim OTP ───────────────────────────────────────────────────────
  const handleRequestOtp = async () => {
    const id = identifier.trim();
    if (id.length < 5) {
      setErrors({ identifier: 'Masukkan email atau nomor HP yang valid' });
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { identifier: id });
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 120);
    } catch {
      Alert.alert(
        'Gagal Mengirim',
        'Terjadi kesalahan. Coba lagi beberapa saat.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: Verifikasi OTP ──────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setErrors({ otp: 'Masukkan 6 digit kode OTP' });
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const res = await api.post<{ reset_token: string }>('/auth/verify-otp', {
        identifier: identifier.trim(),
        otp: code,
      });
      setResetToken(res.data.reset_token);
      setStep('reset');
    } catch {
      setOtp(['', '', '', '', '', '']);
      setErrors({ otp: 'Kode OTP tidak valid atau sudah kadaluarsa' });
      setTimeout(() => otpRefs.current[0]?.focus(), 120);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 3: Reset password ──────────────────────────────────────────────────
  const validateNewPassword = () => {
    const e: typeof errors = {};
    if (newPassword.length < 8) e.newPassword = 'Minimal 8 karakter';
    else if (!/[A-Z]/.test(newPassword)) e.newPassword = 'Harus mengandung 1 huruf kapital';
    else if (!/\d/.test(newPassword)) e.newPassword = 'Harus mengandung 1 angka';
    if (confirmPassword !== newPassword) e.confirmPassword = 'Konfirmasi password tidak cocok';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleResetPassword = async () => {
    if (!validateNewPassword()) return;
    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        reset_token: resetToken,
        new_password: newPassword,
      });
      setStep('success');
    } catch {
      Alert.alert(
        'Gagal Reset',
        'Token tidak valid atau sudah kadaluarsa. Ulangi proses reset password.',
        [{ text: 'OK', onPress: () => setStep('identifier') }],
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── OTP input handlers ──────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (errors.otp) setErrors((e) => ({ ...e, otp: undefined }));
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ── Header config per step ──────────────────────────────────────────────────
  const header = (() => {
    switch (step) {
      case 'identifier': return {
        Icon: Mail,
        title: 'Lupa Password',
        subtitle: 'Masukkan email atau nomor HP terdaftar',
      };
      case 'otp': return {
        Icon: ShieldCheck,
        title: 'Verifikasi OTP',
        subtitle: `Masukkan 6 digit kode yang dikirim ke\n${identifier.trim()}`,
      };
      case 'reset': return {
        Icon: KeyRound,
        title: 'Buat Password Baru',
        subtitle: 'Minimal 8 karakter, 1 huruf kapital, 1 angka',
      };
      case 'success': return {
        Icon: CheckCircle2,
        title: 'Password Berhasil Diubah',
        subtitle: 'Silakan login dengan password baru Anda',
      };
    }
  })();
  const HeaderIcon = header.Icon;

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
          {/* Tombol kembali */}
          {step !== 'success' && (
            <TouchableOpacity
              onPress={() => {
                if (step === 'identifier') router.back();
                else if (step === 'otp') setStep('identifier');
                else if (step === 'reset') setStep('otp');
              }}
              style={{
                position: 'absolute', top: insets.top + 8, left: 16,
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
              }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
          )}

          {/* Lingkaran dekoratif blur */}
          <View style={{
            position: 'absolute', top: -40, right: -40,
            width: 220, height: 220, borderRadius: 110,
            backgroundColor: 'rgba(255,255,255,0.06)',
          }} />

          {/* Header Icon */}
          <View style={{
            width: 72, height: 72, borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.30)',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.28,
            shadowRadius: 20,
          }}>
            <HeaderIcon size={36} strokeWidth={1.7} color="#FFFFFF" />
          </View>

          <Text style={{
            fontSize: 26, fontWeight: '800',
            color: '#FFFFFF', letterSpacing: -0.8,
            textAlign: 'center',
          }}>
            {header.title}
          </Text>
          <Text style={{
            fontSize: 14, color: 'rgba(255,255,255,0.70)',
            marginTop: 8, textAlign: 'center', letterSpacing: 0.1,
            paddingHorizontal: 32,
          }}>
            {header.subtitle}
          </Text>
        </LinearGradient>
      </View>

      {/* ── FORM — glass card overlap ──────────────────────────────────────── */}
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
            {/* ── STEP 1: Identifier ───────────────────────────────────── */}
            {step === 'identifier' && (
              <>
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 9 }}>
                    Email atau Nomor HP
                  </Text>
                  <View style={{ position: 'relative' }}>
                    <View style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                      <Mail size={18} strokeWidth={1.8} color={errors.identifier ? '#FF3B30' : (isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.25)')} />
                    </View>
                    <TextInput
                      value={identifier}
                      onChangeText={(t) => { setIdentifier(t); if (errors.identifier) setErrors({}); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      placeholder="email@perusahaan.id atau 08xxxxxxxxxx"
                      placeholderTextColor={placeholderClr}
                      style={{
                        height: 54, borderRadius: 14,
                        paddingLeft: 48, paddingRight: 18,
                        fontSize: 16, backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: errors.identifier ? '#FF3B30' : inputBorder,
                        color: inputText,
                      }}
                    />
                  </View>
                  {errors.identifier && (
                    <Text style={{ fontSize: 13, color: '#FF3B30', marginTop: 6 }}>{errors.identifier}</Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleRequestOtp}
                  disabled={isLoading}
                  activeOpacity={0.88}
                  style={{
                    height: 58, borderRadius: 16, marginTop: 12,
                    backgroundColor: isLoading ? '#93C5FD' : '#007AFF',
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#007AFF',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.40, shadowRadius: 20,
                    elevation: 8,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
                      Kirim Kode OTP
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 2: OTP ──────────────────────────────────────────── */}
            {step === 'otp' && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      value={digit}
                      onChangeText={(v) => handleOtpChange(i, v)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(i, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      style={{
                        width: 48, height: 58,
                        borderRadius: 14,
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: errors.otp ? '#FF3B30' : (digit ? '#007AFF' : inputBorder),
                        textAlign: 'center',
                        fontSize: 22, fontWeight: '700',
                        color: inputText,
                      }}
                    />
                  ))}
                </View>
                {errors.otp && (
                  <Text style={{ fontSize: 13, color: '#FF3B30', marginTop: 4, marginBottom: 8 }}>{errors.otp}</Text>
                )}

                <TouchableOpacity
                  onPress={handleVerifyOtp}
                  disabled={isLoading || otp.join('').length !== 6}
                  activeOpacity={0.88}
                  style={{
                    height: 58, borderRadius: 16, marginTop: 20,
                    backgroundColor: (isLoading || otp.join('').length !== 6) ? '#93C5FD' : '#007AFF',
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#007AFF',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.40, shadowRadius: 20,
                    elevation: 8,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
                      Verifikasi
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep('identifier')}
                  style={{ alignSelf: 'center', marginTop: 20, paddingVertical: 8 }}
                >
                  <Text style={{ fontSize: 14, color: labelColor }}>
                    Tidak menerima kode?{' '}
                    <Text style={{ color: '#007AFF', fontWeight: '600' }}>Kirim ulang</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 3: Reset password ───────────────────────────────── */}
            {step === 'reset' && (
              <>
                {/* Password baru */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 9 }}>
                    Password Baru
                  </Text>
                  <View style={{ position: 'relative' }}>
                    <View style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                      <KeyRound size={18} strokeWidth={1.8} color={errors.newPassword ? '#FF3B30' : (isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.25)')} />
                    </View>
                    <TextInput
                      value={newPassword}
                      onChangeText={(t) => { setNewPassword(t); if (errors.newPassword) setErrors((e) => ({ ...e, newPassword: undefined })); }}
                      secureTextEntry={!showNew}
                      placeholder="Minimal 8 karakter"
                      placeholderTextColor={placeholderClr}
                      style={{
                        height: 54, borderRadius: 14,
                        paddingLeft: 48, paddingRight: 56,
                        fontSize: 16, backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: errors.newPassword ? '#FF3B30' : inputBorder,
                        color: inputText,
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNew(!showNew)}
                      style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}
                    >
                      {showNew
                        ? <EyeOff size={20} strokeWidth={1.8} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} />
                        : <Eye    size={20} strokeWidth={1.8} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} />
                      }
                    </TouchableOpacity>
                  </View>
                  {errors.newPassword && (
                    <Text style={{ fontSize: 13, color: '#FF3B30', marginTop: 6 }}>{errors.newPassword}</Text>
                  )}
                </View>

                {/* Konfirmasi password */}
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 9 }}>
                    Konfirmasi Password
                  </Text>
                  <View style={{ position: 'relative' }}>
                    <View style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                      <KeyRound size={18} strokeWidth={1.8} color={errors.confirmPassword ? '#FF3B30' : (isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.25)')} />
                    </View>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={(t) => { setConfirmPassword(t); if (errors.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: undefined })); }}
                      secureTextEntry={!showConfirm}
                      placeholder="Ulangi password baru"
                      placeholderTextColor={placeholderClr}
                      style={{
                        height: 54, borderRadius: 14,
                        paddingLeft: 48, paddingRight: 56,
                        fontSize: 16, backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: errors.confirmPassword ? '#FF3B30' : inputBorder,
                        color: inputText,
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirm(!showConfirm)}
                      style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}
                    >
                      {showConfirm
                        ? <EyeOff size={20} strokeWidth={1.8} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} />
                        : <Eye    size={20} strokeWidth={1.8} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} />
                      }
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPassword && (
                    <Text style={{ fontSize: 13, color: '#FF3B30', marginTop: 6 }}>{errors.confirmPassword}</Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  activeOpacity={0.88}
                  style={{
                    height: 58, borderRadius: 16, marginTop: 20,
                    backgroundColor: isLoading ? '#93C5FD' : '#007AFF',
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#007AFF',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.40, shadowRadius: 20,
                    elevation: 8,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
                      Simpan Password Baru
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 4: Success ──────────────────────────────────────── */}
            {step === 'success' && (
              <>
                <View style={{
                  width: 80, height: 80, borderRadius: 40,
                  backgroundColor: isDark ? 'rgba(52,199,89,0.18)' : '#F0FDF4',
                  alignItems: 'center', justifyContent: 'center',
                  alignSelf: 'center', marginBottom: 16,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(52,199,89,0.35)' : 'rgba(52,199,89,0.25)',
                }}>
                  <CheckCircle2 size={44} strokeWidth={1.8} color="#34C759" />
                </View>

                <Text style={{
                  fontSize: 15, textAlign: 'center',
                  color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.55)',
                  marginBottom: 28, paddingHorizontal: 12,
                }}>
                  Akun Anda sudah siap. Login ulang untuk melanjutkan.
                </Text>

                <TouchableOpacity
                  onPress={() => router.replace('/(auth)/login')}
                  activeOpacity={0.88}
                  style={{
                    height: 58, borderRadius: 16,
                    backgroundColor: '#007AFF',
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#007AFF',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.40, shadowRadius: 20,
                    elevation: 8,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
                    Kembali ke Login
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </BlurView>
      </View>
    </KeyboardAvoidingView>
  );
}

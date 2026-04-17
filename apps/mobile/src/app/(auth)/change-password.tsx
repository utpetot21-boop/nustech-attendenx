import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Eye, EyeOff, Lock, ShieldCheck, LogOut } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import api from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { pageBg } from '@/constants/tokens';

export default function ChangePasswordScreen() {
  const isDark   = useColorScheme() === 'dark';
  const insets   = useSafeAreaInsets();
  const logout   = useAuthStore((s) => s.logout);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);

  const bg      = pageBg(isDark);
  const card    = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const primary = isDark ? '#FFFFFF' : '#0F172A';
  const muted   = isDark ? 'rgba(255,255,255,0.45)' : '#64748B';

  async function handleSubmit() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Lengkapi Form', 'Semua field wajib diisi.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password Tidak Sama', 'Password baru dan konfirmasi tidak cocok.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Password Terlalu Pendek', 'Password baru minimal 8 karakter.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      // Hapus flag must_change_password dari store agar AuthGuard tidak loop
      await useAuthStore.getState().updateUser({ must_change_password: false });
      Alert.alert('Berhasil', 'Password berhasil diperbarui.', [
        { text: 'OK', onPress: () => router.replace('/(main)') },
      ]);
    } catch (err: any) {
      Alert.alert('Gagal', err?.response?.data?.message ?? 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: bg }}
    >
      {/* Header gradient */}
      <LinearGradient
        colors={['#007AFF', '#5856D6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 24 }}
      >
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Keluar?', 'Anda harus mengganti password sebelum melanjutkan. Keluar dari akun?', [
              { text: 'Batal', style: 'cancel' },
              { text: 'Keluar', style: 'destructive', onPress: () => logout().then(() => router.replace('/(auth)/login')) },
            ]);
          }}
          style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.18)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}
        >
          <LogOut size={18} strokeWidth={2.2} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{
          width: 52, height: 52, borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.18)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <ShieldCheck size={26} strokeWidth={2} color="#FFFFFF" />
        </View>

        <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 }}>
          Ganti Password
        </Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
          Password lama Anda perlu diperbarui sebelum melanjutkan
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Current password */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          Password Saat Ini
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: card, borderRadius: 14, borderWidth: 1, borderColor: border,
          paddingHorizontal: 14, marginBottom: 20,
        }}>
          <Lock size={16} strokeWidth={1.8} color={muted} style={{ marginRight: 10 }} />
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Masukkan password lama"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#CBD5E1'}
            secureTextEntry={!showCurrent}
            style={{ flex: 1, fontSize: 15, color: primary, paddingVertical: 14 }}
          />
          <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {showCurrent
              ? <EyeOff size={18} strokeWidth={1.8} color={muted} />
              : <Eye size={18} strokeWidth={1.8} color={muted} />}
          </TouchableOpacity>
        </View>

        {/* New password */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          Password Baru
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: card, borderRadius: 14, borderWidth: 1, borderColor: border,
          paddingHorizontal: 14, marginBottom: 20,
        }}>
          <Lock size={16} strokeWidth={1.8} color={muted} style={{ marginRight: 10 }} />
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Minimal 8 karakter"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#CBD5E1'}
            secureTextEntry={!showNew}
            style={{ flex: 1, fontSize: 15, color: primary, paddingVertical: 14 }}
          />
          <TouchableOpacity onPress={() => setShowNew(!showNew)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {showNew
              ? <EyeOff size={18} strokeWidth={1.8} color={muted} />
              : <Eye size={18} strokeWidth={1.8} color={muted} />}
          </TouchableOpacity>
        </View>

        {/* Confirm password */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          Konfirmasi Password Baru
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: card, borderRadius: 14, borderWidth: 1,
          borderColor: confirmPassword && confirmPassword !== newPassword ? '#FF3B30' : border,
          paddingHorizontal: 14, marginBottom: 4,
        }}>
          <Lock size={16} strokeWidth={1.8} color={muted} style={{ marginRight: 10 }} />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Ulangi password baru"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#CBD5E1'}
            secureTextEntry={!showConfirm}
            style={{ flex: 1, fontSize: 15, color: primary, paddingVertical: 14 }}
          />
          <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {showConfirm
              ? <EyeOff size={18} strokeWidth={1.8} color={muted} />
              : <Eye size={18} strokeWidth={1.8} color={muted} />}
          </TouchableOpacity>
        </View>
        {confirmPassword.length > 0 && confirmPassword !== newPassword && (
          <Text style={{ fontSize: 12, color: '#FF3B30', marginBottom: 16, marginLeft: 4 }}>
            Password tidak cocok
          </Text>
        )}

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={{
            marginTop: 24,
            borderRadius: 14,
            overflow: 'hidden',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <LinearGradient
            colors={['#007AFF', '#5856D6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <>
                  <ShieldCheck size={18} strokeWidth={2.2} color="#FFFFFF" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                    Simpan Password Baru
                  </Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

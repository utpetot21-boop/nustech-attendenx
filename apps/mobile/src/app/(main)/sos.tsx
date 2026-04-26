/**
 * M-09 · SCREEN SOS AKTIF
 * Fullscreen darurat — tidak ada tab bar saat SOS aktif
 * GPS tracking setiap 15 detik via WebSocket
 * iOS 26 Liquid Glass design — background merah
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Platform, Animated, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  activateSos, cancelSos, emitLocation, connectSosSocket,
  disconnectSosSocket, SosAlert,
} from '@/services/sos.service';
import { gradients } from '@/constants/tokens';

const TRACK_INTERVAL = 15_000; // 15 detik

export default function SosScreen() {
  const insets = useSafeAreaInsets();
  const [alert, setAlert] = useState<SosAlert | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastLat, setLastLat] = useState<number | null>(null);
  const [lastLng, setLastLng] = useState<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [responded, setResponded] = useState(false);
  const [activating, setActivating] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const trackInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Get initial location and activate
  useEffect(() => {
    const init = async () => {
      setActivating(true);
      // Pola haptic SOS — Heavy impact berulang untuk sensasi darurat
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin diperlukan', 'Izin lokasi diperlukan untuk SOS');
        router.back();
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const bat = await Battery.getBatteryLevelAsync().catch(() => null);
      const batteryPct = bat !== null ? Math.round(bat * 100) : undefined;

      setLastLat(loc.coords.latitude);
      setLastLng(loc.coords.longitude);
      setBattery(batteryPct ?? null);

      const sosAlert = await activateSos(loc.coords.latitude, loc.coords.longitude, batteryPct);
      setAlert(sosAlert);
      setActivating(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // Timer elapsed — dimulai segera setelah SOS aktif
      elapsedInterval.current = setInterval(() => setElapsed((e) => e + 1), 1000);

      // WebSocket connect (non-blocking — tidak await agar timer tidak terhambat)
      connectSosSocket(
        sosAlert.user_id, 'technician',
        () => {},
        () => {},
        () => setResponded(true),
      ).catch((e) => {
        if (__DEV__) console.warn('[SOS] Socket error:', e);
      });

      // Track interval
      trackInterval.current = setInterval(async () => {
        const newLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const newBat = await Battery.getBatteryLevelAsync().catch(() => null);
        const newBatPct = newBat !== null ? Math.round(newBat * 100) : undefined;
        setLastLat(newLoc.coords.latitude);
        setLastLng(newLoc.coords.longitude);
        if (newBatPct !== undefined) setBattery(newBatPct);
        emitLocation(sosAlert.id, newLoc.coords.latitude, newLoc.coords.longitude, newBatPct);
      }, TRACK_INTERVAL);
    };

    init().catch((err) => {
      setActivating(false);
      const msg = err?.response?.data?.message ?? err?.message ?? 'Terjadi kesalahan';
      setInitError(msg);
      Alert.alert('Gagal Mengaktifkan SOS', msg);
    });

    return () => {
      if (trackInterval.current) clearInterval(trackInterval.current);
      if (elapsedInterval.current) clearInterval(elapsedInterval.current);
      disconnectSosSocket();
    };
  }, []);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Batalkan SOS?',
      'Pastikan Anda sudah aman sebelum membatalkan.',
      [
        { text: 'Kembali', style: 'cancel' },
        {
          text: 'Iya, Saya Aman', style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (trackInterval.current) clearInterval(trackInterval.current);
            if (elapsedInterval.current) clearInterval(elapsedInterval.current);
            disconnectSosSocket();
            await cancelSos().catch(() => null);
            router.back();
          },
        },
      ],
    );
  }, []);

  const fmtElapsed = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <LinearGradient
      colors={gradients.emergency}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >

      {/* SOS Pulse Icon */}
      <View style={styles.center}>
        <Animated.View style={[styles.pulseOuter, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.sosBadge}>
          <Text style={styles.sosIcon}>!</Text>
        </View>
        <Text style={styles.sosTitle}>
          {activating ? 'Mengaktifkan SOS…' : initError ? 'GAGAL AKTIFKAN' : 'SOS AKTIF'}
        </Text>
        {initError ? (
          <Text style={[styles.sosSub, { color: '#FFD60A', textAlign: 'center', paddingHorizontal: 20 }]}>
            ⚠ {initError}
          </Text>
        ) : (
          <Text style={styles.sosSub}>
            {responded
              ? '✓ Bantuan sedang dalam perjalanan'
              : 'Bantuan sedang dikirim ke tim Anda'}
          </Text>
        )}
        {!activating && !initError && (
          <Text style={styles.sosHint}>Manajer & kontak darurat diberitahu</Text>
        )}
      </View>

      {/* Info cards */}
      <View style={styles.cards}>
        {/* Lokasi */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>LOKASI SAAT INI</Text>
          {lastLat !== null ? (
            <>
              <Text style={styles.cardValue}>
                {lastLat.toFixed(6)}, {lastLng?.toFixed(6)}
              </Text>
              <Text style={styles.cardSub}>Update {TRACK_INTERVAL / 1000}s sekali</Text>
            </>
          ) : (
            <Text style={styles.cardSub}>Mendapatkan lokasi…</Text>
          )}
        </View>

        {/* Timer + Baterai */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>DURASI SOS</Text>
          <Text style={[styles.cardValue, { fontSize: 28 }]}>{fmtElapsed(elapsed)}</Text>
          {battery !== null && (
            <Text style={styles.cardSub}>🔋 Baterai: {battery}%</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => Alert.alert('Hubungi Darurat', 'Fitur panggilan langsung aktif')}
        >
          <Text style={styles.callBtnText}>📞 Hubungi Darurat</Text>
        </TouchableOpacity>


        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>Batalkan SOS (tekan 2x)</Text>
        </TouchableOpacity>
      </View>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  pulseOuter: {
    position: 'absolute',
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,69,58,0.25)',
  },
  sosBadge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FF453A',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF453A', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 20, elevation: 12,
    marginBottom: 20,
  },
  sosIcon: { fontSize: 36, color: '#fff', fontWeight: '900' },
  sosTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 2, marginBottom: 8 },
  sosSub: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textAlign: 'center' },
  sosHint: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  cards: { padding: 16, gap: 12 },
  card: {
    backgroundColor: 'rgba(255,0,0,0.15)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)',
  },
  cardLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  cardValue: { fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'monospace' },
  cardSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  actions: { padding: 16, gap: 12, paddingBottom: 40 },
  callBtn: {
    backgroundColor: '#34C759', borderRadius: 16,
    padding: 16, alignItems: 'center',
  },
  callBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  mapsBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  mapsBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
});

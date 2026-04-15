/**
 * WeatherBanner — Hero banner dengan animasi cuaca real-time + waktu
 *
 * - Ambil koordinat via expo-location
 * - Fetch cuaca dari Open-Meteo (gratis, tanpa API key)
 * - Animasi berbeda: matahari, awan, hujan, bintang, bulan
 * - Gradient berubah sesuai kondisi cuaca × waktu hari
 */
import { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Bell } from 'lucide-react-native';
import { B } from '@/constants/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'storm'
  | 'snow';

type TimePeriod = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'dusk' | 'night';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getTimePeriod(): TimePeriod {
  const h = new Date().getHours();
  if (h >= 4  && h < 6)  return 'dawn';
  if (h >= 6  && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'afternoon';
  if (h >= 15 && h < 18) return 'evening';
  if (h >= 18 && h < 20) return 'dusk';
  return 'night';
}

export function getPeriodLabel(): string {
  switch (getTimePeriod()) {
    case 'dawn':      return 'Selamat pagi';
    case 'morning':   return 'Selamat pagi';
    case 'afternoon': return 'Selamat siang';
    case 'evening':   return 'Selamat sore';
    case 'dusk':      return 'Selamat sore';
    case 'night':     return 'Selamat malam';
  }
}

function wmoToCondition(code: number): WeatherCondition {
  if (code === 0)                                      return 'clear';
  if (code <= 2)                                       return 'partly_cloudy';
  if (code === 3)                                      return 'cloudy';
  if (code <= 48)                                      return 'fog';
  if (code <= 55)                                      return 'drizzle';
  if (code <= 67 || (code >= 80 && code <= 82))        return 'rain';
  if (code >= 95)                                      return 'storm';
  if (code >= 71 && code <= 77)                        return 'snow';
  return 'cloudy';
}

function conditionEmoji(c: WeatherCondition): string {
  switch (c) {
    case 'clear':         return '☀️';
    case 'partly_cloudy': return '⛅';
    case 'cloudy':        return '☁️';
    case 'fog':           return '🌫️';
    case 'drizzle':       return '🌦️';
    case 'rain':          return '🌧️';
    case 'storm':         return '⛈️';
    case 'snow':          return '❄️';
  }
}

function getGradient(
  condition: WeatherCondition,
  period: TimePeriod,
): readonly [string, string, string] {
  // Cuaca buruk — override waktu
  if (condition === 'storm')
    return ['#1A1A2E', '#2D1B69', '#0F3460'];
  if (condition === 'rain' || condition === 'drizzle') {
    if (period === 'night') return ['#0A0F1E', '#1A2744', '#0D1B3E'];
    return ['#2C3E50', '#3B4F6B', '#4A6080'];
  }
  if (condition === 'fog')
    return ['#7B8FA1', '#A8B8C4', '#8E9EAB'];
  if (condition === 'cloudy') {
    if (period === 'night') return ['#1A1A2E', '#2D3561', '#1E2A4A'];
    return ['#536976', '#6B7F8E', '#4A5D6B'];
  }
  if (condition === 'snow')
    return ['#B8D4E8', '#D4E8F8', '#A0C4DC'];

  // Clear / partly_cloudy — berdasarkan waktu
  switch (period) {
    case 'dawn':      return ['#FF6B35', '#FF9A56', '#FFD580'];
    case 'morning':   return ['#1A3870', '#1D4ED8', '#3B82F6'];
    case 'afternoon': return ['#0369A1', '#0284C7', '#38BDF8'];
    case 'evening':   return ['#C2410C', '#EA580C', '#F97316'];
    case 'dusk':      return ['#4C1D95', '#7C3AED', '#A855F7'];
    case 'night':     return ['#0A0A1A', '#0D1B3E', '#1E1B4B'];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated Elements
// ─────────────────────────────────────────────────────────────────────────────

/** Matahari — berputar lambat + pulsing glow */
function SunElement({ period }: { period: TimePeriod }) {
  const rotation = useSharedValue(0);
  const scale    = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 22000, easing: Easing.linear }),
      -1, false,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.10, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.00, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
    return () => { cancelAnimation(rotation); cancelAnimation(scale); };
  }, []);

  const raysStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isEvening = period === 'evening' || period === 'dusk' || period === 'dawn';
  const sunColor  = isEvening ? '#FF9500' : '#FFD60A';

  return (
    <View style={{
      position: 'absolute', top: 24, right: 36,
      width: 90, height: 90,
      alignItems: 'center', justifyContent: 'center',
      opacity: 0.88,
    }}>
      {/* Rotating rays */}
      <Animated.View style={[{
        position: 'absolute', width: 90, height: 90,
        alignItems: 'center', justifyContent: 'center',
      }, raysStyle]}>
        {[0, 30, 60, 90, 120, 150].map((deg) => (
          <View
            key={deg}
            style={{
              position: 'absolute',
              width: 2, height: 76,
              borderRadius: 1,
              backgroundColor: sunColor + '55',
              transform: [{ rotate: `${deg}deg` }],
            }}
          />
        ))}
      </Animated.View>

      {/* Glow ring */}
      <View style={{
        position: 'absolute',
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: sunColor + '22',
      }} />

      {/* Core */}
      <Animated.View style={[{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: sunColor,
        shadowColor: sunColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 18,
        elevation: 12,
      }, coreStyle]} />
    </View>
  );
}

/** Awan tunggal — drift horizontal
 *  initialX: posisi awal (-150 = off-screen kiri, 0-300 = sudah terlihat)
 *  Jika initialX > -150 maka awan sudah "di tengah perjalanan" saat pertama render
 */
function CloudElement({
  initialX = -150,
  y = 20,
  opacity = 0.65,
  scale = 1,
  speed = 20000,
}: {
  initialX?: number;
  y?: number;
  opacity?: number;
  scale?: number;
  speed?: number;
}) {
  const x = useSharedValue(initialX);
  const totalDist = 570; // dari -150 ke 420

  useEffect(() => {
    if (initialX <= -150) {
      // Loop penuh dari kiri
      x.value = withRepeat(
        withTiming(420, { duration: speed, easing: Easing.linear }),
        -1, false,
      );
    } else {
      // Selesaikan sisa siklus dulu, lalu loop normal dari kiri
      const remaining    = 420 - initialX;
      const firstDur     = Math.round((remaining / totalDist) * speed);
      x.value = withSequence(
        withTiming(420, { duration: firstDur, easing: Easing.linear }),
        withTiming(-150, { duration: 1 }),          // lompat off-screen kiri (instant)
        withRepeat(
          withTiming(420, { duration: speed, easing: Easing.linear }),
          -1, false,
        ),
      );
    }
    return () => cancelAnimation(x);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top: y, left: 0 }, style]}>
      <View style={{ opacity, transform: [{ scale }] }}>
        {/* Awan dari 3 lingkaran + batang dasar */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ width: 38, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.58)' }} />
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.58)', marginLeft: -10 }} />
          <View style={{ width: 50, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.58)', marginLeft: -8 }} />
        </View>
      </View>
    </Animated.View>
  );
}

/** Titik hujan */
function RainDrop({ x, delay, duration, opacity }: {
  x: number; delay: number; duration: number; opacity: number;
}) {
  const y = useSharedValue(-24);

  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withTiming(190, { duration, easing: Easing.linear }),
        -1, false,
      ),
    );
    return () => cancelAnimation(y);
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x }, style]}>
      <View style={{
        width: 1.5, height: 11,
        borderRadius: 1,
        backgroundColor: `rgba(255,255,255,${opacity})`,
        transform: [{ rotate: '10deg' }],
      }} />
    </Animated.View>
  );
}

function RainLayer() {
  const drops = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      x: 8 + i * 24,
      delay: Math.floor((i * 137) % 1300),
      duration: 680 + (i * 83) % 380,
      opacity: 0.28 + (i % 5) * 0.07,
    })),
  []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {drops.map((d, i) => <RainDrop key={i} {...d} />)}
    </View>
  );
}

/** Bintang berkedip */
function Star({ x, y, size, delay }: {
  x: number; y: number; size: number; delay: number;
}) {
  const opacity = useSharedValue(0.15);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.95, { duration: 1200 + delay % 900 }),
          withTiming(0.15, { duration: 1200 + delay % 900 }),
        ),
        -1, false,
      ),
    );
    return () => cancelAnimation(opacity);
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{
      position: 'absolute', left: x, top: y,
      width: size, height: size,
      borderRadius: size / 2,
      backgroundColor: '#FFFFFF',
    }, style]} />
  );
}

function StarField() {
  const stars = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      x: (i * 137) % 320,
      y: (i * 97)  % 105,
      size: 1.5 + (i % 3) * 0.8,
      delay: (i * 211) % 2800,
    })),
  []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {stars.map((s, i) => <Star key={i} {...s} />)}
    </View>
  );
}

/** Bulan dengan glow */
function MoonElement() {
  const glow = useSharedValue(0.45);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.45, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
    return () => cancelAnimation(glow);
  }, []);

  const glowStyle = useAnimatedStyle(() => ({ shadowOpacity: glow.value }));

  return (
    <Animated.View style={[{
      position: 'absolute', top: 26, right: 42,
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: '#FFF9E6',
      shadowColor: '#FFF9E6',
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 22,
      elevation: 10,
    }, glowStyle]}>
      {/* Sabit — lingkaran offset menutupi sebagian */}
      <View style={{
        position: 'absolute', right: -5, top: -5,
        width: 34, height: 34, borderRadius: 17,
        // warna sama dengan gradient tengah agar terlihat sebagai bayangan
        backgroundColor: '#1E1B4B',
      }} />
    </Animated.View>
  );
}

/** Kilat untuk storm */
function LightningElement() {
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Kilat acak tiap beberapa detik
    const flash = () => {
      opacity.value = withSequence(
        withTiming(0.7, { duration: 60 }),
        withTiming(0,   { duration: 80 }),
        withDelay(200, withSequence(
          withTiming(0.5, { duration: 60 }),
          withTiming(0,   { duration: 150 }),
        )),
      );
    };
    flash();
    const id = setInterval(flash, 3500 + Math.floor(Math.random() * 2000));
    return () => { clearInterval(id); cancelAnimation(opacity); };
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(200,220,255,0.5)',
    }, style]} />
  );
}

/** Salju */
function SnowDot({ x, delay, duration }: {
  x: number; delay: number; duration: number;
}) {
  const y    = useSharedValue(-10);
  const sway = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(delay, withRepeat(
      withTiming(190, { duration, easing: Easing.linear }),
      -1, false,
    ));
    sway.value = withRepeat(
      withSequence(
        withTiming(8,  { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(-8, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
    return () => { cancelAnimation(y); cancelAnimation(sway); };
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { translateX: sway.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x }, style]}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.80)' }} />
    </Animated.View>
  );
}

function SnowLayer() {
  const flakes = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      x: (i * 29) % 360,
      delay: (i * 317) % 2000,
      duration: 2800 + (i * 113) % 1200,
    })),
  []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {flakes.map((f, i) => <SnowDot key={i} {...f} />)}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface WeatherBannerProps {
  /** nama user untuk inisial avatar */
  initials: string;
  fullName: string;
  greeting: string;
  todayStr: string;
  /** jumlah notifikasi belum dibaca untuk badge lonceng */
  unreadCount?: number;
  /** konten tambahan di bawah greeting (mis. status badge) */
  children?: React.ReactNode;
}

export default function WeatherBanner({
  initials,
  fullName,
  greeting,
  todayStr,
  unreadCount = 0,
  children,
}: WeatherBannerProps) {
  const insets = useSafeAreaInsets();
  const period = getTimePeriod();

  // ── Ambil lokasi ────────────────────────────────────────────────────────────
  const { data: location } = useQuery({
    queryKey: ['device-location'],
    queryFn: async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      return Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    },
    staleTime: 15 * 60_000,
    retry: false,
    gcTime: 30 * 60_000,
  });

  // ── Ambil cuaca dari Open-Meteo ─────────────────────────────────────────────
  const { data: weather } = useQuery({
    queryKey: ['open-meteo', location?.coords.latitude, location?.coords.longitude],
    queryFn: async () => {
      const { latitude, longitude } = location!.coords;
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
        `&current=weather_code,temperature_2m&timezone=auto`;
      const res  = await fetch(url);
      const json = await res.json();
      return {
        code: json.current.weather_code as number,
        temp: json.current.temperature_2m as number,
      };
    },
    enabled: !!location,
    staleTime: 20 * 60_000,
    retry: false,
    gcTime: 60 * 60_000,
  });

  // ── Tentukan kondisi & elemen ────────────────────────────────────────────────
  const condition: WeatherCondition = weather
    ? wmoToCondition(weather.code)
    : 'clear';

  const gradient = getGradient(condition, period);

  const isNight    = period === 'night' || period === 'dusk';
  const showSun    = !isNight && (condition === 'clear' || condition === 'partly_cloudy' || condition === 'dawn' as any);
  const showClouds = condition === 'partly_cloudy' || condition === 'cloudy' || condition === 'fog' || condition === 'drizzle';
  const showRain   = condition === 'rain' || condition === 'drizzle' || condition === 'storm';
  const showSnow   = condition === 'snow';
  const showStars  = isNight && condition !== 'rain' && condition !== 'storm' && condition !== 'cloudy' && condition !== 'fog';
  const showMoon   = isNight && (condition === 'clear' || condition === 'partly_cloudy');
  const showBolt   = condition === 'storm';

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0.0, y: 0.0 }}
      end={{ x: 1.0, y: 1.0 }}
      style={{
        paddingTop: insets.top + 14,
        paddingHorizontal: 20,
        paddingBottom: 44,
        overflow: 'hidden',
      }}
    >
      {/* Dekoratif lingkaran abstrak */}
      <View style={{
        position: 'absolute', top: -60, right: -60,
        width: 220, height: 220, borderRadius: 110,
        backgroundColor: 'rgba(255,255,255,0.04)',
      }} />
      <View style={{
        position: 'absolute', bottom: 0, left: -80,
        width: 200, height: 200, borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.03)',
      }} />

      {/* ── Weather Animations ──────────────────────────────────────────────── */}
      {showBolt   && <LightningElement />}
      {showSun    && <SunElement period={period} />}
      {showClouds && <CloudElement initialX={-150} y={22} opacity={0.55} scale={0.95} speed={22000} />}
      {showClouds && <CloudElement initialX={110}  y={50} opacity={0.32} scale={0.65} speed={28000} />}
      {showRain   && <RainLayer />}
      {showSnow   && <SnowLayer />}
      {showStars  && <StarField />}
      {showMoon   && <MoonElement />}

      {/* ── Header Row ──────────────────────────────────────────────────────── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 22,
      }}>
        <View style={{ flex: 1, marginRight: 14 }}>
          <Text style={{
            fontSize: 14, fontWeight: '500',
            color: 'rgba(255,255,255,0.55)', marginBottom: 3,
          }}>
            {greeting}
          </Text>
          <Text style={{
            fontSize: 26, fontWeight: '800', color: '#FFFFFF',
            letterSpacing: -0.8, lineHeight: 31,
          }} numberOfLines={1}>
            {fullName}
          </Text>
          {/* Tanggal + chip cuaca — satu baris, tidak ada posisi absolut */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {todayStr}
            </Text>
            {weather && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: 'rgba(0,0,0,0.22)',
                borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
                borderWidth: B.glass, borderColor: 'rgba(255,255,255,0.15)',
              }}>
                <Text style={{ fontSize: 11 }}>{conditionEmoji(condition)}</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.80)' }}>
                  {Math.round(weather.temp)}°
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push('/(main)/notifications' as any)}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: B.glass, borderColor: 'rgba(255,255,255,0.20)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Bell size={17} strokeWidth={1.8} color="rgba(255,255,255,0.90)" />
            {unreadCount > 0 && (
              <View style={{
                position: 'absolute', top: 1, right: 1,
                minWidth: 16, height: 16, borderRadius: 8,
                backgroundColor: '#FF3B30',
                alignItems: 'center', justifyContent: 'center',
                paddingHorizontal: 3,
                borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.3)',
              }}>
                <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800', lineHeight: 12 }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(main)/profile' as any)}
            style={{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
              {initials}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Children (status badge, dll.) ────────────────────────────────────── */}
      {children}
    </LinearGradient>
  );
}

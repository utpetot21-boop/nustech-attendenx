/**
 * M-09b · LAYAR SOS ALERT (PENERIMA)
 * Ditampilkan saat karyawan menerima notif SOS dari rekan kerja.
 * Menampilkan: nama, lokasi koordinat, tombol navigasi Google Maps / Waze.
 * iOS 26 Liquid Glass — background merah gelap.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking,
  Animated, StatusBar, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';

export default function SosAlertScreen() {
  const insets = useSafeAreaInsets();
  const { alertId, lat, lng, userName } = useLocalSearchParams<{
    alertId:  string;
    lat:      string;
    lng:      string;
    userName: string;
  }>();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const latNum = lat ? parseFloat(lat) : null;
  const lngNum = lng ? parseFloat(lng) : null;
  const hasCoords = latNum !== null && lngNum !== null && !isNaN(latNum) && !isNaN(lngNum);

  // Pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // ── Navigation helpers ───────────────────────────────────────────────────────
  const openGoogleMaps = () => {
    if (!hasCoords) return;
    const url = Platform.select({
      ios:     `comgooglemaps://?daddr=${latNum},${lngNum}&directionsmode=driving`,
      android: `google.navigation:q=${latNum},${lngNum}&mode=d`,
    }) ?? `https://maps.google.com/?q=${latNum},${lngNum}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) return Linking.openURL(url);
        // Fallback ke browser
        return Linking.openURL(`https://maps.google.com/?q=${latNum},${lngNum}`);
      })
      .catch(() =>
        Linking.openURL(`https://maps.google.com/?q=${latNum},${lngNum}`),
      );
  };

  const openWaze = () => {
    if (!hasCoords) return;
    const url = `waze://?ll=${latNum},${lngNum}&navigate=yes`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) return Linking.openURL(url);
        return Linking.openURL(`https://waze.com/ul?ll=${latNum},${lngNum}&navigate=yes`);
      })
      .catch(() =>
        Linking.openURL(`https://waze.com/ul?ll=${latNum},${lngNum}&navigate=yes`),
      );
  };

  return (
    <LinearGradient
      colors={['#3e0d0d', '#1f0000', '#3e1a0d']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={[styles.backBtn, { marginLeft: 16 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>← Kembali</Text>
        </TouchableOpacity>

        {/* Pulse Icon */}
        <View style={styles.center}>
          <Animated.View style={[styles.pulseOuter, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.sosBadge}>
            <Text style={styles.sosIcon}>!</Text>
          </View>
          <Text style={styles.title}>SOS DARURAT</Text>
          <Text style={styles.subtitle}>
            {userName ?? 'Rekan Anda'} membutuhkan bantuan
          </Text>
          <Text style={styles.hint}>Periksa apakah kamu berada di dekat lokasi berikut</Text>
        </View>

        {/* Map — Leaflet via WebView, pin merah di lokasi SOS */}
        <View style={styles.mapWrapper}>
          {hasCoords ? (
            <WebView
              style={styles.map}
              originWhitelist={['*']}
              scrollEnabled={false}
              source={{ html: `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; background:#1a1a1a; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
      attributionControl: false,
    }).setView([${latNum}, ${lngNum}], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var redIcon = L.divIcon({
      html: '<div style="width:22px;height:22px;background:#FF453A;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(255,69,58,0.4);"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      className: '',
    });

    L.marker([${latNum}, ${lngNum}], { icon: redIcon })
      .addTo(map)
      .bindPopup('<b>${(userName ?? 'SOS').replace(/'/g, "\\'")}</b><br>Lokasi SOS')
      .openPopup();
  </script>
</body>
</html>` }}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>📍 Koordinat tidak tersedia</Text>
            </View>
          )}
          <LinearGradient
            colors={['transparent', '#1f0000']}
            style={styles.mapFade}
            pointerEvents="none"
          />
        </View>

        {/* Info cards */}
        <View style={styles.cards}>

          {/* Nama */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>PENGIRIM SOS</Text>
            <Text style={styles.cardValue}>{userName ?? '—'}</Text>
          </View>

          {/* Koordinat */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>LOKASI TERAKHIR</Text>
            {hasCoords ? (
              <>
                <Text style={styles.cardValue}>
                  {latNum!.toFixed(6)}, {lngNum!.toFixed(6)}
                </Text>
                <Text style={styles.cardSub}>Klik tombol di bawah untuk navigasi</Text>
              </>
            ) : (
              <Text style={styles.cardSub}>Koordinat tidak tersedia</Text>
            )}
          </View>

        </View>

        {/* Navigation buttons */}
        {hasCoords && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.gmapsBtn} onPress={openGoogleMaps}>
              <Text style={styles.gmapsBtnText}>Navigasi via Google Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.wazeBtn} onPress={openWaze}>
              <Text style={styles.wazeBtnText}>Navigasi via Waze</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dismiss */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <TouchableOpacity style={styles.dismissBtn} onPress={() => router.back()}>
            <Text style={styles.dismissBtnText}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16 },
  backBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  center: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 32, paddingHorizontal: 24,
  },
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
  title: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 2, marginBottom: 8 },
  subtitle: {
    fontSize: 16, color: 'rgba(255,255,255,0.9)',
    fontWeight: '600', textAlign: 'center', marginBottom: 8,
  },
  hint: {
    fontSize: 12, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', paddingHorizontal: 20,
  },
  mapWrapper: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    height: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.4)',
  },
  map: { flex: 1, borderRadius: 18 },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(255,0,0,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  mapFade: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 40,
  },
  cards: { paddingHorizontal: 16, gap: 12 },
  card: {
    backgroundColor: 'rgba(255,0,0,0.15)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)',
  },
  cardLabel: {
    fontSize: 10, fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  cardValue: { fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'monospace' },
  cardSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  actions: { paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  gmapsBtn: {
    backgroundColor: '#34C759', borderRadius: 16,
    padding: 16, alignItems: 'center',
  },
  gmapsBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  wazeBtn: {
    backgroundColor: 'rgba(255,196,0,0.85)', borderRadius: 16,
    padding: 16, alignItems: 'center',
  },
  wazeBtnText: { fontSize: 16, fontWeight: '700', color: '#1a1a00' },
  dismissBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  dismissBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
});

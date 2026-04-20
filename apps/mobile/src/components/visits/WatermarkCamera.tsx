import { useRef, useState, useCallback } from 'react';
// M1: isCapturingRef guards against double-tap without putting isCapturing in useCallback deps
//     — avoids recreating handleCapture on every capture state change
import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as Location from 'expo-location';

interface Props {
  onCapture: (uri: string, lat: number, lng: number) => void;
  onCancel: () => void;
  phaseLabel: string; // e.g. "Foto Sebelum (3/5)"
}

export function WatermarkCamera({ onCapture, onCancel, phaseLabel }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const cameraRef = useRef<CameraView>(null);
  const isCapturingRef = useRef(false);
  const [facing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturingRef.current) return;
    isCapturingRef.current = true;
    setIsCapturing(true);

    try {
      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        exif: true,
        skipProcessing: false,
      });

      if (!photo) throw new Error('Gagal mengambil foto.');

      // Get GPS simultaneously
      let lat = 0;
      let lng = 0;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          lat = parseFloat(loc.coords.latitude.toFixed(6));
          lng = parseFloat(loc.coords.longitude.toFixed(6));
        }
      } catch {
        // GPS failed — proceed with 0,0 (backend will handle)
      }

      onCapture(photo.uri, lat, lng);
    } catch (err) {
      console.warn('WatermarkCamera capture error:', err);
    } finally {
      isCapturingRef.current = false;
      setIsCapturing(false);
    }
  }, [onCapture]);

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <ActivityIndicator color="#FFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: '#111', padding: 32 }]}>
        <Text style={{ color: '#FFF', fontSize: 16, textAlign: 'center', marginBottom: 20 }}>
          Izin kamera diperlukan untuk mengambil foto kunjungan.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{
            backgroundColor: '#007AFF',
            paddingHorizontal: 28,
            paddingVertical: 14,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Izinkan Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={{ marginTop: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Batal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* CameraView tidak mendukung children di expo-camera versi baru — overlay pakai absolute positioning. */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={{ color: '#FFF', fontSize: 16 }}>✕</Text>
        </TouchableOpacity>
        <View style={styles.phaseTag}>
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>
            {phaseLabel}
          </Text>
        </View>
      </View>

      {/* Grid overlay */}
      <View style={styles.gridOverlay} pointerEvents="none">
        <View style={[styles.gridLine, styles.hLine, { top: '33%' }]} />
        <View style={[styles.gridLine, styles.hLine, { top: '66%' }]} />
        <View style={[styles.gridLine, styles.vLine, { left: '33%' }]} />
        <View style={[styles.gridLine, styles.vLine, { left: '66%' }]} />
      </View>

      {/* Watermark preview hint */}
      <View style={styles.watermarkHint} pointerEvents="none">
        <Text style={styles.watermarkText}>📅 Waktu · 📍 GPS · 🗺 Wilayah</Text>
        <Text style={[styles.watermarkText, { opacity: 0.7 }]}>
          Watermark akan diburn otomatis
        </Text>
      </View>

      {/* Bottom shutter */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleCapture}
          disabled={isCapturing}
          style={[styles.shutterBtn, isCapturing && { opacity: 0.6 }]}
          activeOpacity={0.8}
        >
          {isCapturing ? (
            <ActivityIndicator color="#FFF" size="large" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseTag: {
    backgroundColor: 'rgba(0,122,255,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  hLine: {
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  vLine: {
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
  watermarkHint: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 10,
  },
  watermarkText: {
    color: '#FFF',
    fontSize: 11,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
});

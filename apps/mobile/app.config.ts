import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Nustech-AttendenX',
  slug: 'nustech-attendenx',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'attendenx',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F2F2F7',
  },
  assetBundlePatterns: ['**/*'],

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'id.nustech.attendenx',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'Diperlukan untuk validasi lokasi saat absensi.',
      NSLocationAlwaysUsageDescription: 'Diperlukan untuk tracking lapangan teknisi.',
      NSCameraUsageDescription: 'Diperlukan untuk foto kunjungan lapangan.',
      NSFaceIDUsageDescription: 'Diperlukan untuk verifikasi absensi menggunakan Face ID.',
      NSPhotoLibraryUsageDescription: 'Diperlukan untuk menyimpan foto kunjungan.',
      UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
    },
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F2F2F7',
    },
    package: 'id.nustech.attendenx',
    googleServicesFile: './google-services.json',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'CAMERA',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'VIBRATE',
      'RECEIVE_BOOT_COMPLETED',
    ],
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-location',
      { locationAlwaysAndWhenInUsePermission: 'Diperlukan untuk tracking lapangan teknisi.' },
    ],
    [
      'expo-camera',
      { cameraPermission: 'Diperlukan untuk foto kunjungan lapangan.' },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'Digunakan untuk verifikasi absensi Face ID.' },
    ],
    [
      'expo-notifications',
      { icon: './assets/notification-icon.png', color: '#007AFF' },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  // ── EAS & Extra ────────────────────────────────────────────────────────────
  // Setelah eas project:init, isi EAS_PROJECT_ID di .env
  owner: process.env.EXPO_OWNER ?? 'nustech',
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://api.appnustech.cloud/api/v1',
  },
});

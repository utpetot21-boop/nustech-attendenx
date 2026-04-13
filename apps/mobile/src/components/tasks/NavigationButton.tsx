/**
 * NavigationButton — opens Google Maps or Waze with deep link
 * Remembers user preference via AsyncStorage
 */
import { useState } from 'react';
import { TouchableOpacity, Text, ActionSheetIOS, Alert, Platform, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Navigation } from 'lucide-react-native';
import { openGoogleMapsNavigation, openWazeNavigation } from '@/utils/navigation';

const PREF_KEY = 'nav_app_preference';

interface Props {
  lat: number;
  lng: number;
  label?: string;
}

export default function NavigationButton({ lat, lng, label = 'Navigasi' }: Props) {
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    if (loading) return;
    setLoading(true);
    try {
      const pref = await AsyncStorage.getItem(PREF_KEY);

      if (pref === 'gmaps') {
        openGoogleMapsNavigation(lat, lng);
        return;
      }
      if (pref === 'waze') {
        openWazeNavigation(lat, lng);
        return;
      }

      // Show picker
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Batal', 'Google Maps', 'Waze'], cancelButtonIndex: 0 },
          async (idx) => {
            if (idx === 1) { await AsyncStorage.setItem(PREF_KEY, 'gmaps'); openGoogleMapsNavigation(lat, lng); }
            if (idx === 2) { await AsyncStorage.setItem(PREF_KEY, 'waze'); openWazeNavigation(lat, lng); }
          },
        );
      } else {
        Alert.alert('Buka dengan:', '', [
          { text: 'Google Maps', onPress: async () => { await AsyncStorage.setItem(PREF_KEY, 'gmaps'); openGoogleMapsNavigation(lat, lng); } },
          { text: 'Waze', onPress: async () => { await AsyncStorage.setItem(PREF_KEY, 'waze'); openWazeNavigation(lat, lng); } },
          { text: 'Batal', style: 'cancel' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
        alignSelf: 'flex-start',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading
        ? <ActivityIndicator size="small" color="#FFF" />
        : <Navigation size={14} strokeWidth={2.2} color="#FFF" />
      }
      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}
